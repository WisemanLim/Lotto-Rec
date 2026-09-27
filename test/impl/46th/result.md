# 결과 — impl 46th: 자동 등록 제외 번호 그리드 (PRD v1.28 S4.10) — 2026-09-27

## 시도 1 — PASS 7/7

| id | 판정 | 근거 |
|---|---|---|
| 46-1 | PASS | `Recommend.exclude.test.tsx` 1번째 시험(DOM 순서: 필터→그리드→표), 라이브 캡처 `logs/recommend-exclude2.png` |
| 46-2 | PASS | 2번째 시험: 9·23 선택 후 등록 클릭 → `POST /recommend/auto-register` body `{exclude_numbers:[9,23]}` |
| 46-3 | PASS | 3번째 시험: 미선택 시 `exclude_numbers` 키 자체가 없음 |
| 46-4 | PASS | 4번째 시험: '지우기' 클릭 → 선택 해제 |
| 46-5 | PASS | `test_auto_register_excludes_tickets_with_excluded_numbers`: pool=1 로 위치 결정 고정, 제외 번호 포함 티켓은 `excluded_positions` 에 위치·rec_id·ticket 기록되고 `registered`=[] · DB 에 해당 번호 조합 미저장 확인. 제외 목록에 없는 번호는 정상 등록 |
| 46-6 | PASS | `test_auto_register_exclude_numbers_out_of_range_422`: 0·46 모두 422 |
| 46-7 | PASS | pytest 106 passed(+2), vitest 91 passed(+4), tsc·eslint·mypy 무오류. `.env.local` sha1 체크섬 실행 전후 동일(값 13495870 은 세션 중 실사용에 의한 것으로 보이며 건드리지 않음) |

## 설계 결정
- 제외된 (전략, 위치) 조합은 **대체 위치를 다시 뽑지 않는다** — 전략별 등록 수가 `pick`(기본 5)보다 적을 수 있음을 감수. 예측 가능하고 설명하기 쉬운 동작을 우선.
- 선택 상태는 화면 전용(React state) — 저장·서버 반영 없음, 페이지 새로고침 시 초기화.
- UI 는 `LottoBall` 컴포넌트를 재사용해 내 번호 평가 화면과 동일한 공 그리드 스타일을 그대로 따름(중복 컴포넌트 생성 없음).
