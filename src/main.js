import './style.css';

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
  startBtn: document.getElementById('start-btn')
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
  retakeBtn: document.getElementById('retake-btn')
};

// Google Drive Config
// NOTE: To make this fully functional, replace this with a valid Client ID from Google Cloud Console
const GOOGLE_CLIENT_ID = '117288252249205185149.apps.googleusercontent.com';
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
    frameColor: '#ffffff'
  },
  currentPhoto: 0
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

function drawThemeOverlay(ctx, width, height, theme) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (theme === 'cyberpunk') {
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
      updateProgress();
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
  state.capturedPhotos = [];
  state.currentPhoto = 0;
  updateProgress();

  for (let i = 0; i < state.config.photoCount; i++) {
    await takePhotoWithCountdown();
  }

  generatePreview();
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
        state.currentPhoto++;
        updateProgress();

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

  state.capturedPhotos.push(canvas.toDataURL('image/png'));
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
  const totalHeight = (photoHeight * totalPhotos) + (spacing * (totalPhotos - 1)) + (padding * 3); // Extra padding at bottom

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
        drawThemeOverlay(ctx, totalWidth, totalHeight, state.config.theme);

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
        ctx.fillText('V I B E B O O T H', totalWidth / 2, totalHeight - padding * 1.2);

        ctx.font = '300 24px "Outfit", sans-serif';
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)';
        const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        ctx.fillText(dateStr, totalWidth / 2, totalHeight - padding / 2.5);
      }
    };
    img.src = dataUrl;
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

cameraEls.captureBtn.addEventListener('click', startCaptureSequence);

previewEls.downloadBtn.addEventListener('click', downloadStrip);

previewEls.driveBtn.addEventListener('click', uploadToDrive);

previewEls.retakeBtn.addEventListener('click', () => {
  switchView('setup');
});
