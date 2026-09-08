# Lotto-Rec — custom (python-fastapi 베이스 + React SPA) / wise-dev-std 정적 템플릿 기반
# 표준 타겟 (모든 환경 동일 네이밍):
#   make <env>-all | <env>-build | <env>-logs | <env>-stop | <env>-restart | <env>-ps   env = local | dev | staging | prod
#   make db-migrate | db-seed | db-reset | db-fresh [ENV=<env>]     make test | lint | deploy | preflight | help
# 본 프로젝트는 local 전용(PRD §7). dev/staging/prod 타겟은 표준 호환용으로만 유지한다.
.PHONY: help preflight test lint deploy \
        local-all local-build local-logs local-stop local-restart local-ps \
        $(foreach e,dev staging prod,$(e)-all $(e)-build $(e)-logs $(e)-stop $(e)-restart $(e)-ps) \
        db-migrate db-seed db-reset db-fresh
ENV  ?= local
ENVS := dev staging prod
DC   = docker compose $(if $(wildcard .env.$(ENV)),--env-file .env.$(ENV),) --profile app
DCE  = docker compose $(if $(wildcard .env.$*),--env-file .env.$*,) --profile app
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
	@echo "  <env>-all        [dev|staging|prod] infra + app 컨테이너 기동 (표준 호환용 — 본 프로젝트는 local 전용)"
	@echo "  <env>-build      [dev|staging] 이미지 재빌드 후 기동 (prod 미제공)"
	@echo "  <env>-logs/stop/restart/ps   컨테이너 로그/정리/재기동/상태"
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
local-build:    ## [local] 의존성 설치 (uv sync + pnpm install)
	$(UV) sync
	cd frontend && pnpm install
	@[ -f .env.local ] || (cp .env.local.example .env.local && echo ".env.local 생성 (example 복사)")
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
local-stop:     ## [local] backend/frontend 중지 (+ infra 정리)
ifeq ($(PROC_MGR),pm2)
	$(PM2) delete ecosystem.config.cjs || true
else
	@if [ -f $(HONCHO_PIDFILE) ]; then pkill -P $$(cat $(HONCHO_PIDFILE)) 2>/dev/null || true; kill $$(cat $(HONCHO_PIDFILE)) 2>/dev/null || true; rm -f $(HONCHO_PIDFILE); fi
endif
	@if [ -n "$(LOCAL_INFRA)" ]; then docker compose $(if $(wildcard .env.local),--env-file .env.local,) down --remove-orphans; fi
local-restart:  ## [local] backend/frontend 재기동
ifeq ($(PROC_MGR),pm2)
	$(PM2) restart ecosystem.config.cjs
else
	@if [ -f $(HONCHO_PIDFILE) ]; then pkill -P $$(cat $(HONCHO_PIDFILE)) 2>/dev/null || true; kill $$(cat $(HONCHO_PIDFILE)) 2>/dev/null || true; rm -f $(HONCHO_PIDFILE); fi
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

## --- dev/staging/prod: Docker 전체 스택 (표준 호환용, 본 프로젝트 미사용) ---
$(ENVS:%=%-all):     %-all:      # [<env>] infra + app 컨테이너 기동
	$(DCE) up -d
$(filter-out prod-build,$(ENVS:%=%-build)): %-build:  # [dev|staging] 이미지 재빌드 후 기동
	$(DCE) up -d --build
$(ENVS:%=%-logs):    %-logs:     # [<env>] 컨테이너 로그 추적 (SVC=<service>)
	$(DCE) logs -f $(SVC)
$(ENVS:%=%-stop):    %-stop:     # [<env>] app + infra 전체 정리
	$(DCE) down --remove-orphans
$(ENVS:%=%-restart): %-restart:  # [<env>] 컨테이너 재기동 (SVC=<service>)
	$(DCE) restart $(SVC)
$(ENVS:%=%-ps):      %-ps:       # [<env>] 컨테이너 상태
	$(DCE) ps
prod-build:
	@echo "prod-build 미제공 — prod 이미지는 CI/CD 파이프라인 산출물을 사용"; exit 1

## --- DB (ENV=local 기본; SQLite) ---
db-migrate:  ## 마이그레이션 적용 (alembic upgrade head)
	@mkdir -p data
	$(WITH_ENV) $(MIGRATE)
db-seed:     ## 시드 적재 — .docs/lotto(~1240).xlsx 증분 적재 (app.seed)
	$(WITH_ENV) $(SEED)
db-reset:    ## DB 초기화 + 마이그레이션 (local=SQLite 파일 삭제) — 데이터 삭제!
ifeq ($(ENV),prod)
	@echo "prod DB reset 금지"; exit 1
else ifeq ($(ENV),local)
	rm -f $(SQLITE_DB) $(SQLITE_DB)-journal
else
	$(DC) exec -T postgres sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"'
endif
	$(MAKE) db-migrate ENV=$(ENV)
db-fresh: db-reset  ## db-reset + 시드 적재
	$(MAKE) db-seed ENV=$(ENV)
