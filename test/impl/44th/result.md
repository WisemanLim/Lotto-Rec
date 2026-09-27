# 결과 — impl 44th: 'seed 신규' 체크박스 (PRD v1.26) — 2026-09-27

## 시도 1 — PASS 7/7

| id | 판정 | 근거 |
|---|---|---|
| 44-1 | PASS | `Recommend.seedchain.test.tsx` 1번째 시험, 라이브 캡처 `logs/recommend-form.png` 에 'SEED 값 생성' 우측 'seed 신규' 체크박스(해제 상태) 확인 |
| 44-2 | PASS | 동 시험: `/recommend` 호출 body `{seed: null}`(빈칸=.env 기본값), `/recommend/seed-search` 미호출 |
| 44-3 | PASS | 2번째 시험: 체크 후 클릭 → 탐색 시작 → 두 버튼 'SEED 대기 중…' 비활성 → 완료 시 그 seed 로 자동 `/recommend` |
| 44-4 | PASS | 3번째 시험: 이미 완료된 상태에서 체크 안 해도 즉시 생성, 재탐색 없음 |
| 44-5 | PASS | 4번째 시험(핵심 변경): seed 입력에 777 입력 후 신규 체크 → 순차 클릭 → 대기 중 중지 → **취소되지 않고** `/recommend/sequential` 이 `{seed: 777}` 로 호출됨을 확인 |
| 44-6 | PASS | 5번째 시험: status=error → 예약 취소, `/recommend/sequential` 미호출 |
| 44-7 | PASS | vitest 83 passed, tsc·eslint 무오류. 백엔드 파일 변경 없어 재검증 생략(직전 43rd 에서 pytest 104 passed 확인). local 서버가 세션 도중 정지돼 있어 `make local-all` 로 재기동 후 라이브 확인(`.env.local` LOTTO_RANDOM_SEED 는 사용자가 실제 화면에서 SEED 탐색을 완료해 5486654 로 갱신된 것으로 보여 그대로 유지 — 되돌리지 않음) |

## 설계 결정
- 체크박스 기본값 **해제**: "무조건 생성" 문제를 방지하는 것이 요청의 핵심이므로, 평소 클릭은 SEED 탐색을 강제하지 않고 현재 seed 값(빈칸 포함)으로 곧장 생성한다. 새 무작위 seed 를 원할 때만 사용자가 체크한다.
- 중지 시 폴백은 **status=stopped**(사용자 중지·상한 도달 자동 중지 모두 포함)에만 적용하고 **status=error**(탐색 자체 실패)는 기존처럼 예약을 취소한다 — 오류 상황에서 의도치 않은 값으로 조용히 진행하지 않기 위한 안전장치.
