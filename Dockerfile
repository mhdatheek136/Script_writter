# syntax=docker/dockerfile:1.5

# ---------- Stage 1: Frontend build ----------
FROM node:20-slim AS frontend-build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------- Stage 2: Backend base ----------
FROM python:3.11-slim AS backend-base
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    poppler-utils \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Copy the built frontend from Stage 1
COPY --from=frontend-build /frontend/dist ./frontend/dist

RUN useradd -m -u 10001 appuser

EXPOSE 8000

# ---------- Production target ----------
FROM backend-base AS production
USER appuser
# Needs gunicorn in requirements.txt
CMD ["sh", "-c", "gunicorn app.main:app -k uvicorn.workers.UvicornWorker -b 0.0.0.0:${PORT:-8000} --workers 1 --timeout 600 --graceful-timeout 600"]

# ---------- Development target ----------
# FROM backend-base AS development
# CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
