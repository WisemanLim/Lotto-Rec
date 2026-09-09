# 시험 결과 / Test Result — impl 17th (S5.5 등록된 번호로 추첨 시도, PRD v1.8)
- 일자: 2026-09-09 / 대상: custom(react SPA) / 커밋: 70d386b 기준 작업 트리
## 요약
- 전체 6, 통과 6, 실패 0 (테스트 목 1건 수정) → 최종 Verdict: **PASS**
## 케이스
| id | 결과 | 비고 |
|---|---|---|
| 17-1 | PASS | `lib/lottery.test.ts` 2건 — 부분 Fisher–Yates 비복원, LCG seed 재현, pool 3/pick 5 → [1,2,3], pool 0 → [] |
| 17-2 | PASS | `MyNumbers.lottery.test.tsx` — 버튼 `title` `/1\.\.N/`, 저장 0개 disabled(코드: `disabled={!tickets.data?.length}`) |
| 17-3 | PASS | ★ 5개, `nextElementSibling` 이 '삭제' BUTTON, status 문구 일치 |
| 17-4 | PASS | fetch 스텁 비-GET 호출 0건 (`posts` 빈 배열) |
| 17-5 | PASS | App.tsx `/my-numbers` 라우트, Recommend `Link to="/my-numbers"`(S4.7 등록 완료·자동 등록 요약) — 기존 동작 확인, 변경 없음 |
| 17-6 | PASS | `make test` pytest 62/62 + vitest 34/34(13 파일) · `make lint` 클린 |
## 발견 오류 및 수정
| round | 오류 | 원인 | 수정 | 재시험 |
|---|---|---|---|---|
| 1 | 테스트 `TypeError: (q.data ?? []) is not iterable` | 테스트 fetch 스텁이 `/analysis/runs` 목록에 `{}` 반환(RunProvider 는 배열 기대) | 스텁 기본 응답 `[]`, `/config` 객체 | PASS |
## 가정(기본값)
- 위치 = 화면에 로드된 저장 목록 순서(ticket_id 내림차순, 최대 200장). 반복 횟수 = 다음 회차(최신 회차+1). pick = min(5, N).
- 선택은 React 상태만(새로고침·재조회 시 소멸), 재클릭 = 재추첨.
## 첨부
- logs/make-test.log, logs/make-lint.log
