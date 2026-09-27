# 결과 — impl 48th: SEED 값 생성은 제외 번호 미적용 + curl 시나리오 스크립트 (PRD v1.30 S4.13) — 2026-09-27

## 시도 1 — PASS 6/6

| id | 판정 | 근거 |
|---|---|---|
| 48-1 | PASS | `test_seed_search_schema_has_no_exclude_numbers_field` — 실제 기존 구현이 이미 이 요구사항을 만족했음(별도 코드 변경 없음, PRD 로 설계 결정 명문화) |
| 48-2 | PASS | `test_seed_search_ignores_exclude_numbers_even_if_sent`: 직전 회차(999회)의 실제 당첨 번호 전부를 exclude_numbers 로 보내도 무시되어 정상적으로 그 번호들을 맞혀 `status=done` |
| 48-3 | PASS | 라이브 실행: `--exclude "1,2,3,4,5" --count 5 --no-save` → 요청 body 에 `exclude_numbers` 정확히 포함, `--no-save` 로 실행한 별도 `save:false` 컨트롤 호출(90장)에서 제외 번호 0건 검증(공유 DB 오염 없이 API 레벨로 직접 검증) |
| 48-4 | PASS | 라이브 실행: `--use-seed --rank 5 --count 3` → SEED 탐색 124회 만에 완료 → 그 seed(124)가 순차 생성 body 에 정확히 반영됨. 미호출(`--exclude` 단독 실행) 시 body 에 `"seed": null` (서버가 `.env` 기본값 사용) |
| 48-5 | PASS | `--count 5`/`--count 3`/`--count 2` 각각 요청한 개수만큼 생성(9 전략 × count), `--count` 생략 시 body 에 `count` 키 자체가 없어 서버가 `.env LOTTO_NUMBER_RECOMMENDATION_COUNT` 사용 |
| 48-6 | PASS | pytest 121 passed(+2), ruff·mypy 클린. `.env.local` 의 `LOTTO_RANDOM_SEED` 는 라이브 `--use-seed` 실행 자체가 **의도된 기능**으로 갱신(124) — 이는 pytest 격리 픽스처와 무관한 실사용 검증이며, 실행 전후 값을 사용자에게 투명하게 보고 |

## 참고 — DB 교차오염으로 인한 오탐 및 정정
1차 라이브 검증 시 `GET /recommend/history` 로 저장된 티켓을 조회해 제외 번호 위반을 확인하려 했으나, **같은 대상 회차(1244회)에 사용자가 동시에 실제 앱을 사용 중**이어서(세션 내내 `.env.local` 의 `LOTTO_RANDOM_SEED` 가 관찰할 때마다 다른 값으로 바뀌는 것으로 이미 확인됨) 서로 다른 호출의 추천이 같은 기본 seed 로 뒤섞여 저장되어 있었다. 이 때문에 "직전 45회차 기록"을 스캔한 첫 확인에서 제외 번호가 포함된 티켓이 섞여 나와 오탐이 발생했다. `save:false` 로 실행해 **그 호출의 응답 JSON 만** 직접 검사하는 방식으로 재검증했고, 90장 전원 제외 번호를 지키는 것을 확인해 정정했다. 교훈: 공유 개발 DB 를 실시간으로 동시 사용하는 상황에서는 이력 조회가 아니라 **해당 호출의 응답값 자체**로 검증해야 한다.

## 실 DB 영향(투명성 고지)
- 이번 라이브 검증으로 대상 1244회에 사용자 생성(origin=user) 추천이 다음만큼 추가 저장됨: 45장(`--exclude "1,2,3,4,5" --count 5`) + 27장(`--use-seed --rank 5 --count 3`) = 72장. `--no-save` 로 실행한 나머지 검증(90장 + 18장)은 저장되지 않음.
- `.env.local` 의 `LOTTO_RANDOM_SEED` 가 `--use-seed` 실행으로 `124` 로 갱신됨(기능 자체의 의도된 동작).
