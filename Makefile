# Lotto-Rec — custom (python-fastapi 베이스 + React SPA) / wise-dev-std 정적 템플릿 기반
# 표준 타겟 (모든 환경 동일 네이밍):
#   make <env>-all | <env>-build | <env>-logs | <env>-stop | <env>-restart | <env>-ps   env = local | dev | staging | prod
#   make db-migrate | db-seed | db-reset | db-fresh [ENV=<env>]     make test | lint | deploy | preflight | help
# 실행 방식: local 은 호스트 honcho(local-all) 또는 docker(local-build), dev/staging/prod 는 docker compose(<env>-build, PRD S7.2).
.PHONY: help preflight test lint deploy \
        local-install local-all local-build local-logs local-stop local-restart local-ps \
        $(foreach e,dev staging prod,$(e)-all $(e)-build $(e)-logs $(e)-stop $(e)-restart $(e)-ps) \
        db-migrate db-seed db-reset db-fresh reanalyze \
        docker-all docker-build docker-logs docker-stop docker-restart docker-ps docker-migrate docker-seed docker-reanalyze
ENV  ?= local
ENVS := dev staging prod
# 환경별 compose 프로젝트 분리(동시 구동) — local 은 기본 프로젝트(lotto-rec, docker-* 와 공유), 그 외 lotto-rec-<env> (S7.2)
DCE  = ENV=$* docker compose -p lotto-rec-$* --env-file .env.$* --profile app
WITH_ENV = { [ -f .env.$(ENV) ] && set -a && . ./.env.$(ENV) && set +a || true; } &&
# local infra: SQLite 사용 → 기본 없음. 필요 시 LOCAL_INFRA=redis make local-all
LOCAL_INFRA ?=
SQLITE_DB   ?= data/lotto.db
PROC_MGR ?= honcho   # honcho(기본) | pm2(npx, Node 필요)
UV       ?= uv --directory backend
HONCHO   ?= $(UV) run honcho -f ../Procfile.dev
PM2      ?= npx --yes pm2
MIGRATE  ?= $(UV) run alembic upgrade head
SEED     ?= $(UV) run python -m app.seed
help:  ## 타겟 목록
	@grep -hE '^[a-z][a-z-]*:.*## ' $(MAKEFILE_LIST) | sed -E 's/:[^#]*##/\t/' | awk -F'\t' '{printf "  %-16s %s\n", $$1, $$2}'
	@echo "  <env>-build      [dev|staging|prod] 이미지 빌드 후 컨테이너 기동 (.env.<env>, 없으면 .env.<env>.example 복사)"
	@echo "  <env>-all        [dev|staging|prod] 컨테이너 기동 (이미지 없으면 빌드)"
	@echo "  <env>-logs/stop/restart/ps   [dev|staging|prod] 컨테이너 로그(SVC=api|web)/정리/재기동/상태"
	@echo "  db-* 는 ENV=<env> 로 대상 지정 (기본 local)"

## --- 사전 호환성 점검 / Preflight ---
preflight:  ## 런타임·도구 버전 호환성 점검 (python3.12+, uv, node22+, pnpm; docker 는 선택)
	@echo "=== Preflight: Lotto-Rec (python-fastapi + react) ==="
	@command -v python3 >/dev/null 2>&1 || (echo "FAIL: Python 미설치" && exit 1)
	@python3 -c "import sys; v=sys.version_info; exit(0 if v>=(3,12) else 1)" || (echo "FAIL: Python 3.12+ 필요 (현재: $$(python3 --version))" && exit 1)
	@command -v uv >/dev/null 2>&1 || (echo "FAIL: uv 미설치 — brew install uv 또는 curl -LsSf https://astral.sh/uv/install.sh | sh" && exit 1)
	@command -v node >/dev/null 2>&1 || (echo "FAIL: Node 미설치 (22+ 필요)" && exit 1)
	@node -e "process.exit(parseInt(process.versions.node)>=22?0:1)" || (echo "FAIL: Node 22+ 필요 (현재: $$(node -v))" && exit 1)
	@command -v pnpm >/dev/null 2>&1 || (echo "FAIL: pnpm 미설치 — corepack enable && corepack prepare pnpm@latest --activate" && exit 1)
	@command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 || echo "WARN: Docker 미설치 — local 전용(SQLite)이라 필수 아님. dev/staging/prod 타겟만 영향"
	@if [ "$(PROC_MGR)" = "pm2" ]; then command -v npx >/dev/null 2>&1 || echo "WARN: npx 없음 — PROC_MGR=pm2 사용 불가"; fi
	@echo "=== Preflight OK ==="

## --- 공통 / common ---
test:    ## 테스트 실행 (backend pytest + frontend vitest)
	$(UV) run pytest
	cd frontend && pnpm test -- --run
lint:    ## 린트 (ruff + mypy + eslint + tsc)
	$(UV) run ruff check .
	$(UV) run mypy app
	cd frontend && pnpm lint
	cd frontend && pnpm typecheck
deploy:  ## K8s 배포 (Helm) — local 전용 프로젝트, 미사용
	@echo "local 전용 프로젝트 — deploy 미제공"; exit 1

## --- local: (선택) infra(docker) + 호스트 프로세스 매니저 (honcho 기본 · PROC_MGR=pm2 대안) ---
local-install:  ## [local] 호스트 의존성 설치 (uv sync + pnpm install) + .env.local 생성 — honcho 실행 전 1회
	$(UV) sync
	cd frontend && pnpm install
	@[ -f .env.local ] || (cp .env.local.example .env.local && echo ".env.local 생성 (example 복사)")
local-build: docker-all  ## [local·docker] api/web 이미지 빌드 + 컨테이너 기동 (.env.local, = docker-all, S7.2)
HONCHO_PIDFILE := .make/honcho.pid
HONCHO_LOGFILE := .make/honcho.log
local-all:      ## [local] (LOCAL_INFRA 지정 시 docker infra) + backend/frontend 일괄 기동 (백그라운드)
	@if [ -n "$(LOCAL_INFRA)" ]; then docker compose $(if $(wildcard .env.local),--env-file .env.local,) up -d $(LOCAL_INFRA); fi
	@mkdir -p .make data/cache
ifeq ($(PROC_MGR),pm2)
	$(PM2) start ecosystem.config.cjs
else
	@if [ -f $(HONCHO_PIDFILE) ] && kill -0 $$(cat $(HONCHO_PIDFILE)) 2>/dev/null; then \
	  echo "honcho 이미 실행 중 (pid $$(cat $(HONCHO_PIDFILE)))"; \
	else \
	  nohup $(HONCHO) start > $(HONCHO_LOGFILE) 2>&1 & echo $$! > $(HONCHO_PIDFILE); \
	  echo "honcho 백그라운드 기동 (pid $$(cat $(HONCHO_PIDFILE)), 로그: $(HONCHO_LOGFILE))"; \
	  echo "backend  → http://127.0.0.1:$${LOTTO_BACKEND_PORT:-8000}/docs"; \
	  echo "frontend → http://127.0.0.1:$${LOTTO_FRONTEND_PORT:-5173}"; \
	fi
endif
local-logs:     ## [local] 통합 로그 추적 (Ctrl-C 로 tail 종료 — 프로세스는 유지)
ifeq ($(PROC_MGR),pm2)
	$(PM2) logs
else
	@touch $(HONCHO_LOGFILE) && tail -f $(HONCHO_LOGFILE)
endif
local-stop:     ## [local] backend/frontend 중지 (+ infra·local-build 컨테이너 정리)
ifeq ($(PROC_MGR),pm2)
	$(PM2) delete ecosystem.config.cjs || true
else
	@if [ -f $(HONCHO_PIDFILE) ]; then pkill -P $$(cat $(HONCHO_PIDFILE)) 2>/dev/null || true; kill $$(cat $(HONCHO_PIDFILE)) 2>/dev/null || true; rm -f $(HONCHO_PIDFILE); fi
endif
	@if [ -n "$(LOCAL_INFRA)" ]; then docker compose $(if $(wildcard .env.local),--env-file .env.local,) down --remove-orphans; fi
	@# local-build(docker) 로 띄운 local 컨테이너도 함께 정리 (docker 없거나 컨테이너 없으면 무시)
	@if command -v docker >/dev/null 2>&1 && [ -f .env.local ] && [ -n "$$($(DCL) ps -q 2>/dev/null)" ]; then $(DCL) down --remove-orphans; fi
local-restart:  ## [local] backend/frontend 재기동
ifeq ($(PROC_MGR),pm2)
	$(PM2) restart ecosystem.config.cjs
else
	@if [ -f $(HONCHO_PIDFILE) ]; then pkill -P $$(cat $(HONCHO_PIDFILE)) 2>/dev/null || true; kill $$(cat $(HONCHO_PIDFILE)) 2>/dev/null || true; rm -f $(HONCHO_PIDFILE); fi
	@# 이전 uvicorn(reloader+worker)이 포트를 놓을 때까지 대기 — 바로 기동하면 "Address already in use" 로 둘 다 종료됨
	@i=0; while pgrep -f "uvicorn app.main:app" >/dev/null 2>&1 && [ $$i -lt 50 ]; do sleep 0.2; i=$$((i+1)); done
	@mkdir -p .make; nohup $(HONCHO) start > $(HONCHO_LOGFILE) 2>&1 & echo $$! > $(HONCHO_PIDFILE)
	@echo "honcho 재기동 (pid $$(cat $(HONCHO_PIDFILE)))"
endif
local-ps:       ## [local] 프로세스 상태
ifeq ($(PROC_MGR),pm2)
	$(PM2) ls
else
	@if [ -f $(HONCHO_PIDFILE) ] && kill -0 $$(cat $(HONCHO_PIDFILE)) 2>/dev/null; then echo "honcho running (pid $$(cat $(HONCHO_PIDFILE)))"; pgrep -lfP $$(cat $(HONCHO_PIDFILE)) || true; else echo "honcho stopped"; fi
	@$(HONCHO) check
endif

## --- docker (현재 환경, S7.1): backend(api)+frontend(web) 컨테이너 — .env.local 주입, ./data·./.docs 볼륨 공유, api 시작 시 alembic 자동 ---
DCL = docker compose --env-file .env.local --profile app
define DOCKER_PORT_CHECK
	@[ -f .env.local ] || (echo ".env.local 없음 — make local-install 또는 cp .env.local.example .env.local" && exit 1)
	@if [ -f $(HONCHO_PIDFILE) ] && kill -0 $$(cat $(HONCHO_PIDFILE)) 2>/dev/null && [ -z "$$LOTTO_BACKEND_PORT$$LOTTO_FRONTEND_PORT" ]; then \
	  echo "honcho 가 실행 중(pid $$(cat $(HONCHO_PIDFILE))) — 같은 포트를 씁니다. make local-stop 후 실행하거나 LOTTO_BACKEND_PORT=18000 LOTTO_FRONTEND_PORT=15173 make docker-all"; exit 1; fi
endef
docker-build:    ## [docker] api/web 이미지 빌드 (uv.lock·pnpm-lock 고정)
	@[ -f .env.local ] || (echo ".env.local 없음 — make local-install 또는 cp .env.local.example .env.local" && exit 1)
	$(DCL) build
docker-all:      ## [docker] 빌드 + 기동(백그라운드). api 는 alembic upgrade head 후 uvicorn. LOTTO_DOCKER_SEED=1 이면 xlsx 전체 적재
	$(DOCKER_PORT_CHECK)
	$(DCL) up -d --build
	@echo "api → http://127.0.0.1:$${LOTTO_BACKEND_PORT:-$$(grep -E '^LOTTO_BACKEND_PORT=' .env.local | cut -d= -f2 | tr -d ' ')}/docs"
	@echo "web → http://127.0.0.1:$${LOTTO_FRONTEND_PORT:-$$(grep -E '^LOTTO_FRONTEND_PORT=' .env.local | cut -d= -f2 | tr -d ' ')}"
docker-logs:     ## [docker] 로그 추적 (SVC=api|web)
	$(DCL) logs -f $(SVC)
docker-stop:     ## [docker] 컨테이너 정리 (데이터 볼륨은 호스트 ./data 라 유지)
	$(DCL) down --remove-orphans
docker-restart:  ## [docker] 재기동 (SVC=api|web)
	$(DCL) restart $(SVC)
docker-ps:       ## [docker] 상태
	$(DCL) ps
docker-migrate:  ## [docker] 마이그레이션만 실행 (alembic upgrade head)
	$(DCL) run --rm --no-deps --entrypoint "" api uv run --no-sync alembic upgrade head
docker-seed:     ## [docker] 원천 xlsx 전체 회차 적재 (멱등)
	$(DCL) run --rm --no-deps --entrypoint "" api uv run --no-sync python -m app.seed --all
docker-reanalyze: ## [docker] DB 백업 후 군 A·B·ALL 재분석 (PRESET, COHORTS)
	$(DCL) run --rm --no-deps --entrypoint "" api uv run --no-sync python -m app.reanalyze --preset $(PRESET) --cohorts $(COHORTS)

## --- dev/staging/prod: 환경별 docker compose (PRD S7.2) — .env.<env> 주입, 프로젝트·포트·DB 분리 ---
# .env.<env> 가 없으면 저장소의 .env.<env>.example 을 복사해 만든다(git 제외 대상).
define ENV_FILE_CHECK
	@[ -f .env.$* ] || { [ -f .env.$*.example ] && cp .env.$*.example .env.$* && echo ".env.$* 생성 (.env.$*.example 복사) — 필요 시 값 수정"; } || { echo ".env.$* / .env.$*.example 없음"; exit 1; }
endef
define ENV_URLS
	@echo "[$*] api → http://127.0.0.1:$$(grep -E '^LOTTO_BACKEND_PORT=' .env.$* | cut -d= -f2 | cut -d' ' -f1)/docs"
	@echo "[$*] web → http://127.0.0.1:$$(grep -E '^LOTTO_FRONTEND_PORT=' .env.$* | cut -d= -f2 | cut -d' ' -f1)"
endef
$(ENVS:%=%-build):   %-build:    # [<env>] 이미지 빌드 후 컨테이너 기동
	$(ENV_FILE_CHECK)
	$(DCE) up -d --build
	$(ENV_URLS)
$(ENVS:%=%-all):     %-all:      # [<env>] 컨테이너 기동 (이미지 없으면 빌드)
	$(ENV_FILE_CHECK)
	$(DCE) up -d
	$(ENV_URLS)
$(ENVS:%=%-logs):    %-logs:     # [<env>] 컨테이너 로그 추적 (SVC=api|web)
	$(DCE) logs -f $(SVC)
$(ENVS:%=%-stop):    %-stop:     # [<env>] 컨테이너 정리 (데이터는 호스트 ./data 라 유지)
	$(DCE) down --remove-orphans
$(ENVS:%=%-restart): %-restart:  # [<env>] 컨테이너 재기동 (SVC=api|web)
	$(DCE) restart $(SVC)
$(ENVS:%=%-ps):      %-ps:       # [<env>] 컨테이너 상태
	$(DCE) ps

## --- DB (ENV=local 기본; SQLite) ---
db-migrate:  ## 마이그레이션 적용 (alembic upgrade head)
	@mkdir -p data
	$(WITH_ENV) $(MIGRATE)
db-seed:     ## 시드 적재 — .docs/lotto(~1240).xlsx 증분 적재 (app.seed)
	$(WITH_ENV) $(SEED)
db-reset:    ## DB 초기화 + 마이그레이션 (ENV 의 SQLite 파일 삭제, prod 금지) — 데이터 삭제!
ifeq ($(ENV),prod)
	@echo "prod DB reset 금지"; exit 1
else
	@# 모든 환경 SQLite(S7.2) — .env.$(ENV) 의 LOTTO_DB_PATH(local 기본 data/lotto.db, 그 외 data/lotto-<env>.db) 삭제
	$(WITH_ENV) db="$${LOTTO_DB_PATH:-$(SQLITE_DB)}" && rm -f "$$db" "$$db-journal"
endif
	$(MAKE) db-migrate ENV=$(ENV)
db-fresh: db-reset  ## db-reset + 시드 적재
	$(MAKE) db-seed ENV=$(ENV)
PRESET  ?= quick
COHORTS ?= A,B,ALL
reanalyze:   ## DB 백업(data/backup/) 후 군 A·B·ALL 재분석 (PRESET=quick|report|deep, COHORTS=A,B,ALL; 설정은 pydantic 이 .env.local 직접 로드)
	$(UV) run python -m app.reanalyze --preset $(PRESET) --cohorts $(COHORTS)
