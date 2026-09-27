#!/usr/bin/env bash
# recommend-flow.sh — 제외 번호 → SEED 값 생성 → 추천 생성(순차) curl 시나리오 모음 (PRD S4.10/S4.13/S4.14, v1.30)
#
# 시나리오 3단계를 그대로 curl 로 재현한다:
#   1) 제외 번호 전달(없으면 생략 = 제외 없이 생성)
#   2) SEED 값 생성 호출(호출 안 하면 seed 를 비워 .env LOTTO_RANDOM_SEED 기본값 사용)
#   3) 추천 생성(순차) 호출(추천 개수는 옵션, 없으면 .env LOTTO_NUMBER_RECOMMENDATION_COUNT 기본값 사용)
#
# 주의: SEED 값 생성에는 제외 번호를 적용하지 않는다(PRD S4.13 v1.30) — 직전 실제 회차의 실제 당첨
# 번호를 무작위로 맞히는 탐색이라, 제외 번호를 강제하면 그 번호가 실제 당첨 번호 중 하나일 때 목표
# 등수를 영원히 달성할 수 없기 때문이다. 그래서 이 스크립트도 2단계 curl 에 exclude_numbers 를 보내지 않는다.
#
# 사용법:
#   ./scripts/recommend-flow.sh [--exclude "1,2,3"] [--use-seed] [--rank 1] [--count 20] [--no-save] [--base-url http://127.0.0.1:8000]
#
# 예:
#   ./scripts/recommend-flow.sh                                   # 제외 없음, SEED 미호출(.env seed), 개수 .env 기본값
#   ./scripts/recommend-flow.sh --exclude "1,2,3,4,5"             # 제외 번호만 지정
#   ./scripts/recommend-flow.sh --use-seed --rank 5                # SEED 값 생성(희망 5등) 후 그 seed 로 순차 생성
#   ./scripts/recommend-flow.sh --exclude "41,42,43,44,45" --use-seed --count 30
#
# 필요 도구: curl, jq

set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8000}"
EXCLUDE=""       # 콤마 목록, 예: "1,2,3" — 비우면 제외 번호 없이 생성(요구사항 1)
USE_SEED=0       # 1 이면 SEED 값 생성을 호출(요구사항 2)
RANK=1           # SEED 값 생성 희망 등수(1~5), --use-seed 일 때만 사용
COUNT=""         # 추천 개수 — 비우면 옵션 자체를 보내지 않아 .env 기본값 사용(요구사항 3)
SAVE=true        # 실제 "추천 생성(순차)" 와 동일하게 기본 저장. --no-save 로 저장 없이 결과만 확인 가능
POLL_INTERVAL=0.4
POLL_TIMEOUT=60

while [ $# -gt 0 ]; do
  case "$1" in
    --exclude) EXCLUDE="$2"; shift 2 ;;
    --use-seed) USE_SEED=1; shift ;;
    --rank) RANK="$2"; shift 2 ;;
    --count) COUNT="$2"; shift 2 ;;
    --no-save) SAVE=false; shift ;;
    --base-url) BASE_URL="$2"; shift 2 ;;
    -h|--help) tail -n +2 "$0" | grep '^#' | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "알 수 없는 옵션: $1" >&2; exit 1 ;;
  esac
done

command -v jq >/dev/null 2>&1 || { echo "jq 가 필요합니다 (brew install jq)" >&2; exit 1; }

API="$BASE_URL/api/v1"

# 요구사항 1: 제외 번호 → JSON 배열(없으면 null = 생략과 동일 효과)
if [ -n "$EXCLUDE" ]; then
  exclude_json=$(echo "$EXCLUDE" | jq -R -c 'split(",") | map(tonumber)')
  echo "[1] 제외 번호: $exclude_json"
else
  exclude_json="null"
  echo "[1] 제외 번호 미전달 → 제외 없이 생성"
fi

# 요구사항 2: SEED 값 생성(호출 시에만) — 제외 번호는 절대 보내지 않는다(PRD S4.13 v1.30)
seed_json="null"
if [ "$USE_SEED" = "1" ]; then
  echo "[2] SEED 값 생성 시작 (희망 등수 ${RANK}등)…"
  start=$(curl -sS -X POST "$API/recommend/seed-search" \
    -H 'content-type: application/json' \
    -d "{\"target_rank\": ${RANK}}")
  job_id=$(echo "$start" | jq -r '.job_id')
  echo "    job_id=$job_id"

  elapsed=0
  while true; do
    status_body=$(curl -sS "$API/recommend/seed-search/$job_id")
    status=$(echo "$status_body" | jq -r '.status')
    iterations=$(echo "$status_body" | jq -r '.iterations')
    if [ "$status" != "running" ]; then
      echo "    상태=$status (시행 ${iterations}회)"
      break
    fi
    printf '\r    탐색 중… %s회 시도 (%ss 경과)' "$iterations" "$elapsed"
    sleep "$POLL_INTERVAL"
    elapsed=$(echo "$elapsed + $POLL_INTERVAL" | bc)
    if (( $(echo "$elapsed > $POLL_TIMEOUT" | bc -l) )); then
      echo ""
      echo "    ${POLL_TIMEOUT}s 안에 끝나지 않아 중지 요청…"
      curl -sS -X POST "$API/recommend/seed-search/$job_id/stop" > /dev/null
      status_body=$(curl -sS "$API/recommend/seed-search/$job_id")
      break
    fi
  done

  seed_val=$(echo "$status_body" | jq -r '.seed // empty')
  if [ -n "$seed_val" ]; then
    seed_json="$seed_val"
    echo "    seed=$seed_val 를 순차 생성에 사용"
  else
    echo "    일치하는 seed 를 찾지 못함(중지/오류) → .env 기본 seed 사용"
  fi
else
  echo "[2] SEED 값 생성 미호출 → .env LOTTO_RANDOM_SEED 기본값 사용"
fi

# 요구사항 3: 추천 생성(순차) — count 는 옵션(비우면 필드 생략 → .env 기본값)
body=$(jq -n \
  --argjson exclude "$exclude_json" \
  --argjson seed "$seed_json" \
  --argjson save "$SAVE" \
  --arg count "$COUNT" \
  '{save: $save, exclude_numbers: $exclude, seed: $seed}
   + (if $count != "" then {count: ($count | tonumber)} else {} end)')

echo "[3] 추천 생성(순차) 호출…"
echo "    body=$body"
result=$(curl -sS -X POST "$API/recommend/sequential" -H 'content-type: application/json' -d "$body")
echo "$result" | jq '{sequence_id, target_draw_no, total_tickets, failed}'
