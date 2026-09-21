# 결과 — impl 39th: 추첨 개수 .env 관리·입력 박스, 안내 문구 배열 (PRD v1.21) — 2026-09-21

## 시도 1 — PASS 5/5

| id | 판정 | 근거 |
|---|---|---|
| 39-1 | PASS | `test_health.py::test_config_exposes_lottery_pick_count`, 라이브 `/config` = 5 |
| 39-2 | PASS | `MyNumbers.lottery.pick.test.tsx`: config 3 → 초깃값 3·★ 3장, 6 으로 수정 → ★ 6장, 값 없으면 5, 입력 박스가 버튼보다 앞 DOM 순서. 라이브 캡처 `logs/mynumbers.png` 에 '선택 개수 [5]' 가 버튼 앞에 표시 |
| 39-3 | PASS | 같은 시험: 20 → ★ 8장(=N), '', 0, 51, 2.5 → 비활성 |
| 39-4 | PASS | 같은 시험: 범례와 결과 문구가 같은 flex 행, 문구는 범례 다음(ml-auto). 시각 확인은 추첨 클릭이 필요해 미수행 |
| 39-5 | PASS | pytest 91 passed, vitest 70 passed, tsc·eslint·mypy 무오류 |

## 비고
- 개수 수정은 화면 상태만(새로고침 시 .env 값). 사용자 실제 `.env.local` 에는 키가 없어 기본 5 가 적용된다(파일은 수정하지 않음).
