# Multi-Stage Production Dockerfile for ScaleSync Legal Metrology Platform

# Stage 1: Build React/Vite Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/web

# Install frontend dependencies
COPY web/package*.json ./
RUN npm install

# Copy frontend source and compile production bundle
COPY web/ ./
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
