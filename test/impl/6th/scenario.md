# 시나리오 — impl 6th: E9 전략 개선 루프(시뮬레이션 실험) + S4.8 추천 근거 표시 (PRD v0.7)
| id | 목적 | 입력 | 기대결과 | 우선순위 |
|---|---|---|---|---|
| 6-1 | 파라미터 병합 | 범위 초과·미지정 키 | 절단·타입 정규화, 기본값 | P0 |
| 6-2 | analysis_weighted | β=0 | 균등 확률벡터; β>0 이면 z 큰 번호 확률↑ | P0 |
| 6-3 | 파라미터 반영·재현성 | γ 0.5 vs 3.0, 동일 seed | 출력 상이·재현 | P0 |
| 6-4 | 후보 생성 | random/coordinate, uniform | K 개·범위 내·기준 포함, 클리핑 중복 시 종료(무한루프 금지) | P0 |
| 6-5 | best-of-K 영분포 | K=1 vs 8 | K=1 평균≈0, K=8 양수·q95>q50, sd=√(2σ²/n) | P0 |
| 6-6 | replay 순수 함수 | 2 spec × 6회 × 3장 | outcomes 18·scoring 6·metrics diff/brier | P0 |
| 6-7 | 실험 API sync | analysis_weighted K=3, 1001~1008/1009~1016 | done·후보 3·튠/홀드아웃 n=24·h0.k=3·optimism, 겹침 400, 2세대 parent 자동, 활성화→추천 params_used/experiment/analysis_basis, 계보, 비활성화→기본값 | P0 |
| 6-8 | 홀드아웃 회귀 | frequency_hot K=4 | holdout diff CI 방향성 없음, p_best_of_k 존재 | P0 |
| 6-9 | 프론트 탭 | 추천 화면 "전략 개선 루프" 탭 | 활성 버전 카드·새 실험 폼·실험 표·세대 추이 차트·활성화 버튼 | P0 |
| 6-10 | 추천 결과 근거 | 추천 생성 | 세트별 params_used·세대·홀드아웃 판정, analysis_basis(run A·T·상위 z·상위 lift 쌍) 표시 | P0 |
| 6-11 | 실 데이터 실험 | analysis_weighted K=8 1001~1120/1121~1240 ×10장, 2세대 coordinate | done, 결과 PRD §17 기록 | P1 |
| 6-12 | 품질 게이트·라이브 | tsc/eslint/vitest/build, pytest/ruff/mypy, 스크린샷 | 통과·콘솔 오류 0 | P0 |
