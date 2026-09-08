# test/ — 시험 표준 (wise-dev-std test-runner)

모든 테스트는 이 디렉터리 하나로 통일한다 (`tests/` 사용 금지).

| 경로 | 내용 |
|---|---|
| `test/dev-env/` | 표준 환경 검증 1회 — `scenario.md` + `logs/` |
| `test/impl/<Nth>/` | 구현 차수별 시나리오·결과 (`/wise-dev-std:implement` 가 생성) |
| `test/backend/` | pytest 유닛/API 테스트 (`backend/pyproject.toml` testpaths) |
| `frontend/src/**/*.test.tsx` | vitest 컴포넌트 테스트 (프레임워크 관례상 소스 옆 배치) |

사이클: 시나리오 작성 → 시험 진행 → 오류 시 수정·재시험 → 시험결과 작성.
러너: `make test` (= `uv --directory backend run pytest` + `pnpm -C frontend test -- --run`).
원본 로그(`test/**/logs/*`)는 git 제외.

PRD 수용 기준: `.docs/PRD.md` §12 (이론값 단위테스트 §12.1, 시뮬 검증 §12.2, GWT 실데이터 §12.3).
