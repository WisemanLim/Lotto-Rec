# 시나리오 — impl 11th: 용어 툴팁·용어 사전 (PRD v1.2 공통 UX)
| id | 목적 | 입력 | 기대결과 | 우선순위 |
|---|---|---|---|---|
| 11-1 | 용어 데이터 | glossary.ts | ≥45 용어, 각각 label·short(쉬운 설명)·links(위키/논문) 보유, id 중복 없음 | P0 |
| 11-2 | Term 컴포넌트 | hover/focus | role=tooltip 표시(설명+링크), aria-describedby 연결, ESC/blur 로 닫힘, 미등록 id 는 텍스트만 | P0 |
| 11-3 | 용어 사전 페이지 | /glossary | 분류별 목록·검색·링크(target=_blank rel=noopener), 사이드바 메뉴 | P1 |
| 11-4 | 화면 적용 | 개요·빈도·조합·그룹·시간·검증·추천/실험·내 번호·성과 추적 | 핵심 용어(KPI 라벨·표 헤더·섹션 제목·판정 배지)에 Term 적용; 예: 그룹 패턴 "영분포" → 하이퍼지오메트릭/MC 설명 | P0 |
| 11-5 | 게이트·라이브 | 전체 | tsc/eslint/vitest/build 통과, 툴팁 렌더 스크린샷, 콘솔 오류 0 | P0 |
