# 결과 — impl 49th: 제외 번호 '자동' 추천(추첨 동향 기반) (PRD v1.31/v1.31.1 S4.15) — 2026-09-28

## 시도 1 — PASS 7/7 (이후 사용자 보고로 시도 2)

| id | 판정 | 근거 |
|---|---|---|
| 49-1 | PASS | `Settings` 필드 `lotto_exclude_trend_draws`(30, 3–200)·`lotto_exclude_recent_draws`(5, 1–50), `.env.local.example` 반영. `.env.local` 사용자 값(50/10)이 기본값을 덮어쓰는 것 확인 |
| 49-2 | PASS | `test_suggest_exclude_numbers_hot_cold_and_intersection`: 격리 in-memory DB(pool=10, 6회차) → hot [1,2], cold [9,10], 직전 2회 [1,2,3,4,5,8,10], 교집합 [1,2,10], selected ⊂ 교집합·≤2개 |
| 49-3 | PASS | seed 지정 재현성, 빈 DB → selected=[] 안전 반환 |
| 49-4 | PASS | API 기본값 = 현재 settings, 범위 밖 422(trend 2/201, recent 0/51) |
| 49-5 | PASS | `/config`·설정 화면 CONFIG_HELP 노출, OpenAPI 스냅샷에 `POST /api/v1/recommend/exclude-suggestion` |
| 49-6 | PASS | vitest: '자동' 클릭 → API 호출 → 기존 선택(9) 해제, 응답 [11,23] 선택(교체). 안내 문구 `text-xs text-neutral-500` |
| 49-7 | PASS | pytest 126, vitest 95, ruff·mypy·eslint·tsc 무오류 |

## 시도 2 — 사용자 보고 버그: '자동' 재클릭해도 같은 번호

- 원인: seed 미지정 시 `settings.lotto_random_seed`(고정 124)를 사용 → 교집합 23개 중 10개 추출이 매번 동일.
- 수정: seed 미지정 시 `secrets.randbelow(2**31)` — 호출마다 새 무작위, 사용 seed 는 응답에 남겨 `seed` 지정 시 재현(S4.10 자동 등록과 동일 규칙).

| id | 판정 | 근거 |
|---|---|---|
| 49-8 | PASS | `test_suggest_exclude_numbers_without_seed_varies_per_call`: 20회 호출 seed·selected 모두 복수 값, 응답 seed 로 재현 일치. 라이브 서버 3회 호출 → seed 642441506/1350065673/1313677235, selected 모두 다름(최근 50회·각 16개·교집합 23개 중 10개) |

최종: pytest 127, vitest 95, ruff·mypy 클린.

## 설계 결정
- 후보 동률은 번호 오름차순(결정적). 본번호 6개만 집계, 보너스 제외.
- 추출 개수 = min(교집합 크기, `LOTTO_EXCLUDE_RECENT_DRAWS`) — 사용자가 개수를 별도로 정하지 않아 기존 env 를 상한으로 재사용(가정).
- '자동'은 화면 상태만 교체, 저장 없음. 교집합이 비면 선택 없음.
- 부수 수정: 프론트 `RecommendIn`/`SequentialIn` 타입에 누락된 `exclude_numbers` 추가(백엔드는 v1.29 부터 지원).
