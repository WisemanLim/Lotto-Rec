# Lotto-Rec backend — uv.lock 고정 설치. 프로젝트 루트 = /srv/lotto (app/core/config.py 의 PROJECT_ROOT = backend/ 상위)
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 UV_LINK_MODE=copy UV_COMPILE_BYTECODE=1
RUN pip install --no-cache-dir uv
WORKDIR /srv/lotto/backend
# 1) 의존성 레이어 (소스 변경 시 재사용)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
# 2) 소스
COPY . .
RUN uv sync --frozen --no-dev && chmod +x docker-entrypoint.sh
RUN mkdir -p /srv/lotto/data/cache /srv/lotto/.docs
EXPOSE 8000
HEALTHCHECK --interval=5s --timeout=3s --retries=20 --start-period=10s \
  CMD [".venv/bin/python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2).status == 200 else 1)"]
ENTRYPOINT ["./docker-entrypoint.sh"]
