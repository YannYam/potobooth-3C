import './style.css';
import logoSrc from './img/3C_optimized.png';

// DOM Elements
const views = {
  setup: document.getElementById('setup-view'),
  camera: document.getElementById('camera-view'),
  preview: document.getElementById('preview-view')
};

const setupEls = {
  photoCount: document.getElementById('photo-count'),
  frameTheme: document.getElementById('frame-theme'),
  frameColor: document.getElementById('frame-color'),
  themePreviewCanvas: document.getElementById('theme-preview-canvas'),
  startBtn: document.getElementById('start-btn'),
  customFrameUploadGroup: document.getElementById('custom-frame-upload-group'),
  customFrameUpload: document.getElementById('custom-frame-upload')
};

const cameraEls = {
  video: document.getElementById('video'),
  countdown: document.getElementById('countdown'),
  flash: document.getElementById('flash'),
  progress: document.getElementById('photo-progress'),
  captureBtn: document.getElementById('capture-btn')
};

const previewEls = {
  canvas: document.getElementById('output-canvas'),
  downloadBtn: document.getElementById('download-btn'),
  driveBtn: document.getElementById('drive-btn'),
  retakeBtn: document.getElementById('retake-btn'),
  individualPhotosContainer: document.getElementById('individual-photos-container')
};

// Google Drive Config
// NOTE: To make this fully functional, replace this with a valid Client ID from Google Cloud Console
const GOOGLE_CLIENT_ID = '114993439314356360088.apps.googleusercontent.com';
let tokenClient;

window.onload = () => {
  if (window.google) {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (tokenResponse) => {
        if (tokenResponse && tokenResponse.access_token) {
          executeDriveUpload(tokenResponse.access_token);
        }
      },
    });
  }
};

// App State
const state = {
  stream: null,
  capturedPhotos: [],
  config: {
    photoCount: 4,
    theme: 'minimalist',
    frameColor: '#ffffff',
    customImage: null
  },
  currentPhoto: 0,
  retakingIndex: null
};

// Functions
function switchView(viewName) {
  Object.values(views).forEach(v => v.classList.remove('active'));
  views[viewName].classList.add('active');
}

function drawThemeBackground(ctx, width, height, theme, baseColor) {
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, width, height);

  if (theme === 'cyberpunk') {
    ctx.fillStyle = '#0d0221';
    ctx.fillRect(0, 0, width, height);
    // Draw neon grid
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    for (let i = 0; i < width; i += 40) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, height); ctx.stroke();
    }
    for (let i = 0; i < height; i += 40) {
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(width, i); ctx.stroke();
    }
  } else if (theme === 'floral') {
    ctx.fillStyle = '#f4ecd8'; // vintage paper
    ctx.fillRect(0, 0, width, height);
  } else if (theme === 'cute-animals') {
    ctx.fillStyle = '#ffb3ba'; // pastel pink
    ctx.fillRect(0, 0, width, height);
  } else if (theme === 'party') {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#ff00cc');
    grad.addColorStop(1, '#333399');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }
}

function drawThemeOverlay(ctx, width, height, theme, customImage = null) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (theme === 'custom' && customImage) {
    ctx.drawImage(customImage, 0, 0, width, height);
  } else if (theme === 'cyberpunk') {
    ctx.font = '60px Arial';
    ctx.fillText('👾', width - 60, 60);
    ctx.fillText('⚡', 60, height - 150);
  } else if (theme === 'floral') {
    ctx.font = '80px Arial';
    ctx.fillText('🌸', 60, 60);
    ctx.fillText('🌿', width - 60, 150);
    ctx.fillText('🌺', width - 70, height - 160);
    ctx.fillText('🍃', 70, height - 200);
  } else if (theme === 'cute-animals') {
    ctx.font = '80px Arial';
    ctx.fillText('🐱', 70, 70);
    ctx.fillText('🐰', width - 70, 70);
    ctx.fillText('🐾', width - 70, height - 180);
    ctx.fillText('✨', 70, height - 180);
  } else if (theme === 'party') {
    ctx.font = '80px Arial';
    ctx.fillText('🎉', 70, 70);
    ctx.fillText('🎈', width - 70, 90);
    ctx.fillText('✨', width - 80, height - 160);
    ctx.fillText('🎊', 80, height - 180);
  }
}


async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 960 },
        facingMode: "user"
      }
    });
    state.stream = stream;
    cameraEls.video.srcObject = stream;
    switchView('camera');

    // Slight delay to ensure video is ready
    setTimeout(() => {
      cameraEls.captureBtn.classList.remove('hidden');
      if (state.retakingIndex === null) {
        updateProgress();
      } else {
        cameraEls.progress.textContent = `Retaking Photo #${state.retakingIndex + 1}`;
      }
    }, 1000);
  } catch (err) {
    console.error("Error accessing camera: ", err);
    alert("Could not access the camera. Please ensure you have granted permission.");
  }
}

function stopCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach(track => track.stop());
    state.stream = null;
  }
}

function updateProgress() {
  cameraEls.progress.textContent = `${state.currentPhoto} / ${state.config.photoCount}`;
}

async function startCaptureSequence() {
  cameraEls.captureBtn.classList.add('hidden');
  
  if (state.retakingIndex !== null) {
    await takePhotoWithCountdown();
    state.retakingIndex = null;
    generatePreview();
  } else {
    state.capturedPhotos = [];
    state.currentPhoto = 0;
    updateProgress();

    for (let i = 0; i < state.config.photoCount; i++) {
      await takePhotoWithCountdown();
    }

    generatePreview();
  }
}

function takePhotoWithCountdown() {
  return new Promise(resolve => {
    let count = 3;
    cameraEls.countdown.textContent = count;
    cameraEls.countdown.classList.remove('hidden');

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        cameraEls.countdown.textContent = count;
      } else {
        clearInterval(interval);
        cameraEls.countdown.classList.add('hidden');

        // Flash effect
        cameraEls.flash.classList.remove('hidden');
        cameraEls.flash.classList.add('active');

        setTimeout(() => {
          cameraEls.flash.classList.remove('active');
          cameraEls.flash.classList.add('hidden');
        }, 300);

        captureFrame();
        if (state.retakingIndex === null) {
          state.currentPhoto++;
          updateProgress();
        }

        // Wait a bit before next countdown
        setTimeout(resolve, 1000);
      }
    }, 1000);
  });
}

function captureFrame() {
  const canvas = document.createElement('canvas');
  canvas.width = cameraEls.video.videoWidth;
  canvas.height = cameraEls.video.videoHeight;
  const ctx = canvas.getContext('2d');

  // Mirror the image to match video
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(cameraEls.video, 0, 0, canvas.width, canvas.height);

  if (state.retakingIndex !== null) {
    state.capturedPhotos[state.retakingIndex] = canvas.toDataURL('image/png');
  } else {
    state.capturedPhotos.push(canvas.toDataURL('image/png'));
  }
}

function generatePreview() {
  stopCamera();
  switchView('preview');

  const ctx = previewEls.canvas.getContext('2d');

  // Frame layout configuration
  const padding = 40;
  const spacing = 20;
  // Use a standard aspect ratio for individual photos (e.g., 4:3)
  const photoWidth = 800;
  const photoHeight = 600;

  const totalPhotos = state.config.photoCount;

  // Calculate canvas dimensions
  const totalWidth = photoWidth + (padding * 2);
  const logoAreaHeight = 80; // space for the 3C logo
  const totalHeight = (photoHeight * totalPhotos) + (spacing * (totalPhotos - 1)) + (padding * 3) + logoAreaHeight; // Extra padding at bottom + logo

  previewEls.canvas.width = totalWidth;
  previewEls.canvas.height = totalHeight;

  // Draw background frame
  drawThemeBackground(ctx, totalWidth, totalHeight, state.config.theme, state.config.frameColor);

  // Load and draw all photos
  let loadedCount = 0;

  state.capturedPhotos.forEach((dataUrl, index) => {
    const img = new Image();
    img.onload = () => {
      const y = padding + (index * (photoHeight + spacing));
      ctx.drawImage(img, padding, y, photoWidth, photoHeight);

      // Draw subtle inner shadow/border for realism
      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 2;
      ctx.strokeRect(padding, y, photoWidth, photoHeight);

      loadedCount++;
      if (loadedCount === totalPhotos) {
        // Draw theme overlay (stickers/characters)
        drawThemeOverlay(ctx, totalWidth, totalHeight, state.config.theme, state.config.customImage);

        // Add branding/text at the bottom
        let isDark = false;
        if (state.config.theme === 'cyberpunk' || state.config.theme === 'party') {
          isDark = true;
        } else if (state.config.theme === 'minimalist') {
          const hex = state.config.frameColor.replace('#', '');
          const r = parseInt(hex.substr(0, 2), 16);
          const g = parseInt(hex.substr(2, 2), 16);
          const b = parseInt(hex.substr(4, 2), 16);
          const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
          isDark = yiq < 128;
        }

        ctx.fillStyle = isDark ? '#ffffff' : '#1a1a1a';
        ctx.font = 'bold 45px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.letterSpacing = '5px'; // HTML5 Canvas letterSpacing support
        ctx.fillText('EXPO - UKM 3C', totalWidth / 2, totalHeight - padding * 1.2);

        ctx.font = '300 24px "Outfit", sans-serif';
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)';
        const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        ctx.fillText(dateStr, totalWidth / 2, totalHeight - padding / 2.5);

        // Draw 3C.png logo centered between photos and text
        const logo = new Image();
        logo.onload = () => {
          const logoSize = 60;
          const logoX = (totalWidth - logoSize) / 2;
          // Place logo between the last photo and the branding text
          const lastPhotoBottomY = padding + ((totalPhotos - 1) * (photoHeight + spacing)) + photoHeight;
          const brandingTopY = totalHeight - padding * 1.2 - 45; // approximate top of brand text
          const logoY = lastPhotoBottomY + ((brandingTopY - lastPhotoBottomY - logoSize) / 2);
          ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
          
          renderIndividualThumbnails();
        };
        logo.src = logoSrc;
      }
    };
    img.src = dataUrl;
  });
}

function renderIndividualThumbnails() {
  if (!previewEls.individualPhotosContainer) return;
  previewEls.individualPhotosContainer.innerHTML = '';
  state.capturedPhotos.forEach((dataUrl, index) => {
    const item = document.createElement('div');
    item.style.position = 'relative';
    item.style.borderRadius = '8px';
    item.style.overflow = 'hidden';
    item.style.aspectRatio = '4/3';
    item.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
    
    const img = document.createElement('img');
    img.src = dataUrl;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.style.display = 'block';
    
    const btn = document.createElement('button');
    btn.className = 'primary-btn';
    btn.style.position = 'absolute';
    btn.style.bottom = '8px';
    btn.style.left = '50%';
    btn.style.transform = 'translateX(-50%)';
    btn.style.padding = '0.3rem 0.6rem';
    btn.style.fontSize = '0.8rem';
    btn.style.width = 'auto';
    btn.style.background = 'rgba(0,0,0,0.6)';
    btn.style.color = '#fff';
    btn.style.border = '1px solid rgba(255,255,255,0.3)';
    btn.style.backdropFilter = 'blur(4px)';
    btn.style.cursor = 'pointer';
    btn.textContent = `Retake`;
    
    // Add hover effect for the button
    btn.onmouseover = () => {
      btn.style.background = 'rgba(255,255,255,0.2)';
    };
    btn.onmouseout = () => {
      btn.style.background = 'rgba(0,0,0,0.6)';
    };

    btn.onclick = () => {
      state.retakingIndex = index;
      startCamera();
    };
    
    item.appendChild(img);
    item.appendChild(btn);
    previewEls.individualPhotosContainer.appendChild(item);
  });
}

function downloadStrip() {
  previewEls.canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `vibebooth-${Date.now()}.png`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 'image/png');
}

function uploadToDrive() {
  if (GOOGLE_CLIENT_ID === 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com') {
    alert("Please configure your GOOGLE_CLIENT_ID in src/main.js to enable Google Drive uploads.");
    return;
  }
  if (!tokenClient) {
    alert("Google Identity Services failed to load. Check your connection.");
    return;
  }
  tokenClient.requestAccessToken({ prompt: '' });
}

function executeDriveUpload(accessToken) {
  previewEls.driveBtn.textContent = 'Uploading...';
  previewEls.driveBtn.disabled = true;

  previewEls.canvas.toBlob((blob) => {
    const metadata = {
      name: `VibeBooth-${Date.now()}.png`,
      mimeType: 'image/png'
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      body: form
    })
      .then(response => {
        if (response.ok) return response.json();
        throw new Error('Upload failed');
      })
      .then(data => {
        alert("Successfully saved to Google Drive!");
      })
      .catch(error => {
        console.error("Drive upload error:", error);
        alert("Failed to upload to Google Drive.");
      })
      .finally(() => {
        previewEls.driveBtn.textContent = 'Save to Drive';
        previewEls.driveBtn.disabled = false;
      });
  }, 'image/png');
}

// Event Listeners
setupEls.startBtn.addEventListener('click', () => {
  state.config.photoCount = parseInt(setupEls.photoCount.value);
  state.config.theme = setupEls.frameTheme.value;
  state.config.frameColor = setupEls.frameColor.value;
  startCamera();
});

function updateThemePreview() {
  const canvas = setupEls.themePreviewCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Set dimensions for the preview canvas
  canvas.width = 400;
  canvas.height = 600;

  const theme = setupEls.frameTheme.value;
  const baseColor = setupEls.frameColor.value;

  // Draw background
  drawThemeBackground(ctx, canvas.width, canvas.height, theme, baseColor);

  // Draw mock photo placeholders
  ctx.fillStyle = 'rgba(200, 200, 200, 0.6)';
  ctx.fillRect(40, 40, 320, 220); // Photo 1 placeholder
  ctx.fillRect(40, 280, 320, 220); // Photo 2 placeholder

  // Draw theme elements/stickers scaled down for preview
  drawThemeOverlay(ctx, canvas.width, canvas.height, theme, state.config.customImage);

  // Add text
  let isDark = false;
  if (theme === 'cyberpunk' || theme === 'party') {
    isDark = true;
  } else if (theme === 'minimalist') {
    const hex = baseColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    isDark = yiq < 128;
  }

  ctx.fillStyle = isDark ? '#ffffff' : '#1a1a1a';
  ctx.font = 'bold 24px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.letterSpacing = '3px';
  ctx.fillText('EXPO - UKM 3C', canvas.width / 2, canvas.height - 40);

  // Draw 3C.png logo scaled down for preview
  const logo = new Image();
  logo.onload = () => {
    const logoSize = 30; // scaled down size for preview
    const logoX = (canvas.width - logoSize) / 2;
    // Place logo roughly in the gap between the bottom photo placeholder and text
    const logoY = canvas.height - 85; 
    ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
  };
  logo.src = logoSrc;
}

setupEls.frameTheme.addEventListener('change', () => {
  if (setupEls.frameTheme.value === 'custom') {
    setupEls.customFrameUploadGroup.style.display = 'block';
  } else {
    setupEls.customFrameUploadGroup.style.display = 'none';
  }
  updateThemePreview();
});

setupEls.customFrameUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        state.config.customImage = img;
        updateThemePreview();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  } else {
    state.config.customImage = null;
    updateThemePreview();
  }
});
setupEls.frameColor.addEventListener('input', () => {
  // When using the custom color picker, mark the custom swatch as active
  document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
  document.querySelector('.swatch-custom').classList.add('active');
  updateThemePreview();
});

// Swatch click handlers
document.querySelectorAll('.swatch:not(.swatch-custom)').forEach(swatch => {
  swatch.addEventListener('click', () => {
    const color = swatch.dataset.color;
    setupEls.frameColor.value = color;
    document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
    swatch.classList.add('active');
    updateThemePreview();
  });
});

// Initialize preview on page load
updateThemePreview();

cameraEls.captureBtn.addEventListener('click', startCaptureSequence);

previewEls.downloadBtn.addEventListener('click', downloadStrip);

previewEls.driveBtn.addEventListener('click', uploadToDrive);

previewEls.retakeBtn.addEventListener('click', () => {
  switchView('setup');
});
