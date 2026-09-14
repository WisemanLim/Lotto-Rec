# 결과 — impl 20th: `.env.local` 값 미적용 수정 (PRD v1.9.2) — 2026-09-14

## 시도 1 — PASS 6/6

| id | 판정 | 근거 |
|---|---|---|
| 20-1 | PASS (원인 확정) | `.env.local`=20 인데 `Settings().lotto_number_recommendation_count`=10, `GET /config`=10. `core/config.py` 의 `env_file=(.env.local, .env.local.example)` — pydantic-settings 2.15 는 튜플의 **뒤 파일이 앞 파일을 덮어씀** → example 기본값이 항상 승리. `.env` 로 이름 바꿔도 로드 대상이 아니라 동일 |
| 20-2 | PASS | `test_settings_env_precedence.py::test_env_local_overrides_example`: local 20 > example 10, OS env 30 > 파일, 없는 키는 example 값 |
| 20-3 | PASS | `test_default_env_file_order_puts_local_last`: `[.env.local.example, .env, .env.local]` |
| 20-4 | PASS | `test_auto_register` 에 `settings.lotto_number_recommendation_count` monkeypatch=10 (수정 전 `.env.local`=20 환경에서 `pool==10` 단언 실패 → 테스트가 env 에 의존하던 결함) |
| 20-5 | PASS | `make local-restart` → `GET /config` `lotto_number_recommendation_count = 20` |
| 20-6 | PASS | pytest 65/65 · vitest 37/37 · ruff/mypy/eslint/tsc clean |

## 변경 파일
- backend `app/core/config.py`(env_file 순서 example → .env → .env.local, 주석), test `test_settings_env_precedence.py`(신규), `test_auto_register.py`(monkeypatch)
- docs `.docs/PRD.md` v1.9.2(§10 우선순위, 변경 이력), `README.md`/`README.en.md`(환경 변수 우선순위 문구, 트러블슈팅 행)

## 비고
- `.env*` 변경은 uvicorn `--reload` 감시 대상이 아님 → 값 변경 후 `make local-restart` 필요.
- `test/backend/test_engine.py` 의 기존 ruff 경고(B007/F841)는 이번 변경과 무관, `make lint` 범위(backend/) 밖이라 미수정.
