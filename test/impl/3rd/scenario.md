# 시나리오 — impl 3rd: E3 검증 · E4 추천 · E5 사용자 평가 · E8 성과 추적
| id | 목적 | 입력 | 기대결과 | 우선순위 |
|---|---|---|---|---|
| 3-1 | 가중 비복원 표본 | w=1..45 | 6개 유일·정렬·범위, 고가중 번호 ≥3배 빈도 | P0 |
| 3-2 | 6개 전략 생성 | T=300 시뮬 이력, 10장, max_shared=3 | 유일 10장, 공유 ≤3, 동일 seed 재현 | P0 |
| 3-3 | low_competition 폴백 | 모형 없음 | uniform 폴백 + meta.fallback | P1 |
| 3-4 | 확률 예보 벡터 | uniform/hot/bayes | Σ=6, >0 | P0 |
| 3-5 | 추천 API | strategy=frequency_hot | 개수 = env(10), control(uniform) 동시, 스코어카드(번호6·쌍15·일치분포 합1·전형성), history, 8전략 카탈로그, 400 | P0 |
| 3-6 | 사용자 번호 평가·저장·자동 대조 | [3,9,14,22,37,44] 저장 후 대상 회차 입력 | target=max+1, pending 반영, 3일치→5등 5,000원, tracking summary/outcomes | P0 |
| 3-7 | 등수·당첨금 규칙 | 단위 | 1~5등·낙첨 규칙, 1·2등 회차 당첨금, 3등 기본값 | P0 |
| 3-8 | replay 검증(소규모) | 1001~1012, 3전략×4장, sync | done, meta 12회, backtest 48장·기대 0.8, 비교·스코어링·재현성·동질성(df 44), tracking origin=backtest | P0 |
