# Multi-Stage Production Dockerfile for ScaleSync Legal Metrology Platform

# Stage 1: Build React/Vite Frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/web

# Copy package descriptors and install dependencies in Linux environment
COPY web/package*.json ./
RUN npm install

# Copy frontend source code (ignoring local node_modules via .dockerignore)
COPY web/src/ ./src/
COPY web/public/ ./public/
COPY web/index.html ./index.html
COPY web/vite.config.js ./vite.config.js

# Build production bundle
RUN npm run build

# Stage 2: Production Python Backend + Static Web Serving
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies (curl for healthchecks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python backend dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./app_backend/

# Copy compiled frontend assets into backend static dist directory
COPY --from=frontend-builder /app/web/dist ./app_backend/web_dist/

# Set working directory to backend
WORKDIR /app/app_backend

# Expose default port
EXPOSE 8000
ENV PORT=8000
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/app_backend

# Healthcheck for container orchestrators
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

# Launch FastAPI application using dynamic Render PORT
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
