# 결과 — impl 18th: 내 번호 중복 등록 ★ 표시 (S5.6, PRD v1.9) — 2026-09-12

## 시도 1 — PASS 8/8

| id | 판정 | 근거 |
|---|---|---|
| 18-1 | PASS | `test_user_ticket_duplicate_merge_and_group`: 역순 번호 2회 저장 → 동일 ticket_id, dup_count=2, dup_labels 2개, duplicate=true. live: `logs/auto_register_merge.log` A/B |
| 18-2 | PASS | 같은 번호 target+1 → 새 행, duplicate=true, same_number_ticket_ids 상호 참조 (pytest + live C) |
| 18-3 | PASS | GET /user/tickets 행마다 dup_count·dup_labels·same_number_ticket_ids·duplicate (pytest) |
| 18-4 | PASS | `test_auto_register`: 같은 seed 2회 → total_registered=0, total_merged=n, merged_duplicates[].dup_count≥2, 행 수 불변. live run2: 0 / 45 |
| 18-5 | PASS | `MyNumbers.dup.test.tsx`: ★ 중복 ×3 / ×2 배지(data-testid=dup-badge), 단일 번호 없음, 병합 라벨 `(+추천 uniform #4)`, hover → duplicate_ticket 툴팁 "증거가 아니다" |
| 18-6 | PASS | `Recommend.history.test.tsx`: duplicate 응답 → "★ 중복 — 내 번호 #77 에 병합(×2)" |
| 18-7 | PASS | Alembic `5b12a3e10f18`(멱등, server_default 1/[]) 기존 DB upgrade OK — 1차 실패 후 수정 (log 참조) |
| 18-8 | PASS | pytest 63/63 · vitest 35/35 (14 files) · ruff/mypy(44 files)/eslint/tsc clean · `pnpm build` OK · OpenAPI 경로 스냅샷 불변(경로 추가 없음) |

## 변경 파일
- backend: `app/db/models.py`(UserTicket.dup_count/dup_labels), `alembic/versions/5b12a3e10f18_*.py`, `app/services/recommend_service.py`(save_user_ticket 병합, auto_register skip→merge: `merged_duplicates`/`total_merged`), `app/api/user.py`(`_same_number_map`, 응답 4필드)
- frontend: `api/client.ts`(UserTicket·AutoRegisterResult 타입), `lib/glossary.ts`(`duplicate_ticket`), `pages/MyNumbers.tsx`(★ 배지+Term), `pages/Recommend.tsx`(병합 메시지·자동등록 요약/확인문구), 테스트 3건
- docs: `.docs/PRD.md` v1.9(S5.6, S4.10 병합 규칙, API 표, 변경 이력), `README.md`/`README.en.md`(API 행·impl/18th)

## 비고
- 호환성 변경: auto-register 응답 `skipped_existing`/`total_skipped` → `merged_duplicates`/`total_merged` (스킵 대신 병합). OpenAPI 경로 스냅샷은 불변.
- 해석 원칙 유지: ★ 은 "여러 배치에서 반복 생성됨"의 표시일 뿐, 툴팁·용어 사전에 유의성/당첨확률 상승 증거가 아님을 명시.
