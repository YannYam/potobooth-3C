# Build stage
FROM node:18-alpine as build-stage
WORKDIR /app
COPY package*.json ./
COPY . .
# Remove any host node_modules that might have been copied, then install fresh
RUN rm -rf node_modules && npm install
RUN npm run build

# Production stage
FROM nginx:alpine as production-stage
# Replace the ENTIRE main nginx config (not just the server block)
# This ensures only port 8080 is active — required for Cloud Run
COPY nginx.conf /etc/nginx/nginx.conf
# Copy the built Vite assets to Nginx's serve directory
COPY --from=build-stage /app/dist /usr/share/nginx/html
# Cloud Run requires port 8080
EXPOSE 8080
# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
