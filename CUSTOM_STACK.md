# CUSTOM_STACK — Lotto-Rec

> `wise-dev-std` / 프로파일 `custom` 으로 스캐폴딩 (2026-09-08). 근거: `.docs/PRD.md` §8, `/wise-dev-std:recommend` 결과.

## 스캐폴드 결정 요약

| 항목 | 값 | 출처 |
|---|---|---|
| 프로젝트 이름 | Lotto-Rec | 디렉터리명 |
| 플랫폼 | 웹 서비스 (backend API + SPA) | PRD §1 |
| base_profile | `python-fastapi` | 지정: python, fastapi |
| 프론트엔드 | `react` (Vite SPA, TS, Tailwind, Plotly, TanStack Query, react-router) | 지정: react. SSR 불필요(PRD A5) → Next.js 미채택 |
| 데이터베이스 | **SQLite** (`data/lotto.db`, SQLAlchemy 2 + Alembic) + `.npy` 영분포 캐시(`data/cache/`) | 지정: sqlite. 프로파일 기본(postgres)과 다름 — 아래 편차 |
| 캐시/메시징 | 없음 | local 전용, in-process 백그라운드 |
| 환경 구성 | **local 전용** (`.env.local` 만 생성) | PRD §7. dev/staging/prod Makefile 타겟은 표준 호환용으로만 유지 |
| 업종 도메인 | `ict-saas` (KSIC J) — 베이스라인 | `COMPLIANCE.md` 참조. 개인 로컬이라 규제 항목 대부분 해당 없음 |
| 프로세스 매니저 | honcho (`Procfile.dev`, 기본) / pm2 (`ecosystem.config.cjs`, 대안) | python-fastapi 표준 |
| gitignore | `_common` + `_platform` + `python` + `node` + 프로젝트 섹션 | §2.7 조립 |

## 지정 vs 추론

| 컴포넌트 | 지정 | 추론 |
|---|---|---|
| runtime | python, node(프론트) | — |
| backend framework | fastapi | — |
| frontend | react | Vite 번들러, Tailwind, Plotly(히트맵/네트워크), TanStack Query |
| database | sqlite | SQLAlchemy 2 + Alembic(`render_as_batch`) |
| ops | — | GitHub Actions(backend/frontend 2 job), Docker(표준 호환 스텁) |

## 프로파일 기본값과의 편차 (이유 기록)

1. **DB = SQLite (postgres 아님)**: 개인 로컬 단일 사용자, 결과 테이블 ≤ 수만 행. 설치 부담 제거. dev+ 환경 자체가 없음.
2. **Docker infra 없음**: `make local-all` 은 `LOCAL_INFRA` 지정 시에만 `docker compose up`. `preflight` 에서 Docker 는 WARN.
3. **`.env.dev/.env.staging/.env.prod` 미생성**: PRD 비목표(배포 없음). 필요 시 `/wise-dev-std:env-init` 로 추가.
4. **pyproject 가 `backend/` 에 위치**: 모노레포(`backend/` + `frontend/`). Makefile 은 `uv --directory backend`, `pnpm -C frontend` 로 호출.
5. **pytest testpaths = `../test/backend`**: 시험 표준(루트 `test/` 통일) 준수. vitest 는 프레임워크 관례상 `frontend/src/*.test.tsx`.
6. **`make deploy` 비활성**: local 전용.

## 다음 단계

```bash
make preflight      # 도구 점검
make local-install  # uv sync + pnpm install (+ .env.local 생성)  ※ v1.32: local-build 는 docker 빌드·구동으로 변경
make db-migrate     # SQLite 생성 (초기 리비전은 구현 단계에서 autogenerate)
make local-all      # backend :8000 + frontend :5173
make test           # 스모크 + 이론값 테스트
```

이후 `/wise-dev-std:env-init`(선택) → `/wise-dev-std:standardize`(선택) → `/wise-dev-std:implement`.
