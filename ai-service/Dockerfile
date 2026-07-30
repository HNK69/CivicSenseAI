# ─── CivicSense AI Service — Single-stage Dockerfile ──────────────────────────
# Python 3.12 slim image.  Ollama runs on the HOST — this container only
# runs the FastAPI service and talks to Ollama via OLLAMA_HOST env var.
#
# Build:  docker build -t civicsense-ai .
# Run:    docker run --rm -p 8000:8000 \
#           -e OLLAMA_HOST=host.docker.internal \
#           -e GEMMA_MODEL=gemma4:12b \
#           civicsense-ai

FROM python:3.12-slim

# ── System dependencies needed by OpenCV and FAISS ────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1-mesa-glx \
        libglib2.0-0 \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# ── Working directory ─────────────────────────────────────────────────────────
WORKDIR /app

# ── Install Python dependencies (cached layer) ────────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

# ── Copy application source ───────────────────────────────────────────────────
COPY app/ ./app/

# ── Runtime environment defaults (overridable at docker run) ──────────────────
ENV SERVICE_NAME=civicsense-ai \
    SERVICE_VERSION=0.1.0 \
    ENVIRONMENT=production \
    LOG_LEVEL=INFO \
    OLLAMA_HOST=host.docker.internal \
    OLLAMA_PORT=11434 \
    GEMMA_MODEL=gemma4:12b \
    GEMMA_TIMEOUT_SECONDS=120 \
    OLLAMA_PROBE_TIMEOUT_SECONDS=10 \
    EMBEDDING_MODEL=bge-m3:latest \
    EMBEDDING_DIMENSION=1024 \
    FAISS_INDEX_DIR=/app/data/faiss \
    FAISS_TOP_K=10

# ── FAISS data directory ──────────────────────────────────────────────────────
RUN mkdir -p /app/data/faiss

# ── Non-root user for container security ──────────────────────────────────────
RUN useradd -m -u 1001 appuser \
 && chown -R appuser:appuser /app
USER appuser

# ── Healthcheck (Docker-level, complements /api/v1/health) ────────────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c \
        "import urllib.request, sys; \
         r = urllib.request.urlopen('http://localhost:8000/api/v1/health', timeout=8); \
         sys.exit(0 if r.status == 200 else 1)"

EXPOSE 8000

# ── Start the service ─────────────────────────────────────────────────────────
CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "1", \
     "--loop", "asyncio"]
