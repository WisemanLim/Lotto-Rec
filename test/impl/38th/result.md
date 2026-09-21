# 결과 — impl 38th: 추첨 시도 ★ 상단 정렬·최근 6회차 출현 테두리 (PRD v1.20) — 2026-09-21

## 시도 1 — PASS 6/6 (1 수정)

| id | 판정 | 근거 |
|---|---|---|
| 38-1 | PASS | `MyNumbers.lottery.hits.test.tsx`: 7장 중 ★ 5장이 앞 5행 [true×5,false×2] |
| 38-2 | PASS | 같은 시험: `data-hits`·툴팁 '최근 6회차 1등 번호에 2회 출현', 28 은 미표시 |
| 38-3 | PASS | `hitRing.test.ts` 색·이중 링 순서, `logs/rings.png` 캡처(흰 링으로 공 색과 구별) |
| 38-4 | PASS | 미선택 티켓 boxShadow 없음, 추첨 전 `[data-hits]` 0개·범례 없음 |
| 38-5 | PASS | 사용자 예시 6회차 목업으로 위 횟수 그대로 검증 |
| 38-6 | PASS(1 수정) | vitest 66 passed, tsc·eslint 무오류. 기존 `MyNumbers.recent.test.tsx` 가 회차 조회를 1회로 가정 → 표시용 1회 + 출현 횟수용 limit=6 조회를 허용하도록 갱신 |

## 비고
- 6회차 조회는 추천 화면 칩과 같은 캐시 키를 사용한다. `LOTTO_RECENT_DRAWS`(표시용 개수)와는 독립이다.
- 캡처는 앱 화면이 아니라 동일 색·링 규칙의 정적 HTML 이다(추첨 시도 클릭이 필요해 헤드리스 단독 캡처 불가). 실제 화면은 사용자 확인 필요.
