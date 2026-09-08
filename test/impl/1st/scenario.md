# 시나리오 — impl 1st: E1 데이터 적재·검증·증분 import (PRD §E1, §3.4, §12.3)
| id | 목적 | 입력 | 기대결과 | 우선순위 |
|---|---|---|---|---|
| 1-1 | 원천 파싱 | lotto(~1240).xlsx | 1,240건, invalid 0, 오름차순 저장 | P0 |
| 1-2 | 행 검증 | 중복·범위·보너스중복·파일내 중복 행 | 각 사유로 invalid, 정상 1건만 통과 | P0 |
| 1-3 | seed 군 A | `make db-seed` | 1~1,000회만 적재 | P0 |
| 1-4 | 증분 import | 998~1003 CSV | 3 삽입 / 3 중복 제외 / 재업로드 0 삽입 | P0 |
| 1-5 | 충돌 | 번호 다른 1000회 | 삽입 0, 충돌 1(rejected), 기존 불변 | P0 |
| 1-6 | 단일 회차 입력 + summary + imports | POST /data/draws | 삽입 1, 422(중복번호), summary cohort 집계, import_log 기록 | P0 |
| 1-7 | 미지원 포맷 | .pdf/.json | 400 | P1 |
