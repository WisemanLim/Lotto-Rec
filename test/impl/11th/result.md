# 시험 결과 / Test Result — impl 11th (용어 툴팁·용어 사전, PRD v1.2)
- 일자: 2026-09-08 / 대상: custom(react SPA) / 커밋: (git 미초기화)
## 요약
- 전체 5, 통과 5, 실패 0 → 최종 Verdict: **PASS**
## 케이스
| id | 결과 | 비고 |
|---|---|---|
| 11-1 | PASS | `lib/glossary.ts` 65 용어 · 7 분류 · id 유일 · 설명 20자+ · 60%+ 링크(위키백과 ko/en, Genest 2002, Coronel-Brizio 2008, Haigh 1997, Baker–McHale 2009, Gneiting–Raftery 2007, BH 1995, PELT) — Term.test |
| 11-2 | PASS | Term.test — hover → role=tooltip(설명+detail+↗링크 target=_blank rel=noopener), aria-describedby 연결, ESC 닫힘, 미등록 id 텍스트만, icon 모드 (?) 토글 |
| 11-3 | PASS | `/glossary` 65 항목 렌더(dt 65), 검색·분류 필터, 해시(#id) 스크롤·하이라이트, 사이드바 "용어 사전" |
| 11-4 | PASS | 서브에이전트 적용: Pairs 26 · ExperimentLoop 23 · Validation 20 · Temporal 16 · Frequency 15 · Recommend 12 · Overview 12 · PerformancePanel 12 · ScorecardView 11 · Groups 6 · Tracking 4 · Settings 4 · VerdictBadge 2 · MyNumbers 1 · PolicyBanner 1 (총 165). 라이브 그룹 패턴: term 49개, "영분포" hover → "하이퍼지오메트릭 분포로 정확히 … 몬테카를로(MC) 시뮬레이션으로 영분포를 만든다" + 링크 2개 (사용자 예시 그대로) |
| 11-5 | PASS | tsc 0 · eslint 0 · vitest 28/28 (11 files; 신규 Term 3 + Groups.term 1) · build OK · 콘솔 오류 0 · logs/shot-groups-tooltip.png |
## 발견 오류 및 수정
| round | 오류 | 원인 | 수정 | 재시험 |
|---|---|---|---|---|
| — | 없음 (라이브 검증 시 synthetic `mouseenter` 가 React onMouseEnter 를 트리거하지 않아 `mouseover`/focus 로 확인) | — | — | — |
## 첨부
- logs/vitest.log, logs/shot-groups-tooltip.png
