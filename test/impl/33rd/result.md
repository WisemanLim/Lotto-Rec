# 결과 — impl 33rd: 설정/실행 결과 입력 재구성 (PRD v1.16 S1.6) — 2026-09-21

## 시도 1 — PASS 6/6

| id | 판정 | 근거 |
|---|---|---|
| 33-1 | PASS | `Tracking.entry.test.tsx` 배치 순서·최상위 grid-cols-2 제거 |
| 33-2 | PASS | 동 파일, `role=group '파일 업로드 도구'` flex-nowrap |
| 33-3 | PASS | 동 파일 payload 검증(winners1·prize1·prize3·winners5, 미입력은 null) |
| 33-4 | PASS | `test/backend/test_draw_prize_ranks.py` 4건 |
| 33-5 | PASS | 동 파일 `test_actual_prize_used_for_rank_3_to_5_else_default` |
| 33-6 | PASS | `data/backup/lotto_pre_v116_*.db` 백업 후 `make db-migrate`, `pragma table_info(draws)` 에 6개 컬럼 확인, 라이브 `/data/draws/1242` 응답에 prize3.. null 포함 |

## 발견 사항 (미수정, 사용자 결정 필요)
- 1241·1242회는 과거 수동 입력 시 '1등 당첨금' 칸에 **등위별 총 당첨금**(예: 1242회 29,529,263,250원)이 들어가 있다. xlsx 시드(≤1240회)는 **1게임당 당첨금**이다. 성과 추적은 1게임당 값을 전제로 하므로 두 행은 당첨금 합산 시 과대 계상된다(총액÷당첨자수 = 3,281,029,250 으로 정확히 나누어짐). 새 입력 라벨은 '1게임당 당첨금'으로 명확히 했다.

## 후속 조치 (2026-09-21, 사용자 승인)
1241·1242회의 1·2등 금액을 총액÷당첨자 수로 정정(모두 나머지 0). 사전 백업 `data/backup/lotto_pre_prizefix_*.db`. 1242회: 1등 3,281,029,250 / 2등 47,322,538, 1241회: 1등 1,628,391,980 / 2등 54,279,733. 영향받는 1·2등 outcome 없음.
