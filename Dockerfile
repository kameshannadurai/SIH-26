# Multi-Stage Production Dockerfile for ScaleSync Legal Metrology Platform
FROM node:20-alpine AS frontend-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN npm run build

FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt backend/requirements.production.txt ./
RUN pip install --no-cache-dir -r requirements.production.txt

COPY backend/ ./app_backend/
COPY --from=frontend-builder /app/web/dist ./web_dist/

WORKDIR /app/app_backend

EXPOSE 8000
ENV PORT=8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
