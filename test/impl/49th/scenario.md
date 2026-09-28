# 시나리오 — impl 49th: 제외 번호 '자동' 추천(추첨 동향 기반) — PRD v1.31 S4.15

## 배경
사용자 요청: 추천-제외번호 로직 개선. 최근 추첨번호 N회(.env, 기본 30)의 추첨 동향을 적용 — 가장 많이
추첨된 번호와 가장 적게 추첨된 번호를 각 N//3 개(기본 10+10=20개) 뽑고, 그중 직전 M회(.env, 기본 5)에
실제로 나온 번호와의 교집합에서 무작위로 제외 번호를 채우는 '자동' 버튼을 '제외 번호' 타이틀 우측에 추가.
부수: 제외 번호 안내 문구 글씨 스타일을 전략별 설명 문구와 동일하게 축소.

## 수용 기준
1. `.env.local.example` 에 `LOTTO_EXCLUDE_TREND_DRAWS`(기본 30) · `LOTTO_EXCLUDE_RECENT_DRAWS`(기본 5) 추가,
   `backend/app/core/config.py` Settings 필드 반영.
2. `POST /api/v1/recommend/exclude-suggestion` {trend_draws?, recent_draws?, seed?} →
   {selected, hot_candidates, cold_candidates, recent_numbers, intersection, seed, note, …}.
   - hot_candidates = 최근 trend_draws 회 최다 추첨 trend_draws//3 개(동률 번호 오름차순).
   - cold_candidates = 최근 trend_draws 회 최소 추첨 trend_draws//3 개(동률 번호 오름차순).
   - intersection = (hot∪cold) ∩ (직전 recent_draws 회 실제 출현 번호).
   - selected = intersection 에서 최대 recent_draws 개를 무작위(seed 재현 가능)로 추출, 오름차순 정렬.
   - trend_draws 범위 3~200, recent_draws 범위 1~50 (벗어나면 422).
   - 적재된 회차가 없으면 selected=[] 로 안전 반환(크래시 없음).
3. `GET /api/v1/config` · 설정 화면 `CONFIG_HELP` 에 두 값 노출.
4. 프론트 '제외 번호' 타이틀 우측 **'자동'** 버튼 — 클릭 시 위 API 호출 → 응답 `selected` 로 제외 번호
   그리드를 **교체**(기존 수동 선택 지움). 안내 문구(`'추천 생성'·…`) 글씨는 전략 설명 문구와 같은
   `text-xs text-neutral-500` 로 축소(기존 `text-sm` 내 `font-normal` 대비).
5. `test/backend/openapi_paths.snapshot.json` 에 새 경로 반영.
6. 전체 회귀: `pytest`(backend) · `vitest`(frontend) · `ruff` · `mypy` · `eslint` · `tsc` 모두 통과.

## 시험 방법
- 백엔드: `test/backend/test_exclude_suggestion.py` — 격리된 in-memory DB 로 hot/cold/intersection 을 손으로
  검증 가능한 소규모 시나리오(pool=10, trend_draws=6, recent_draws=2)로 구성해 정확히 계산되는지 확인,
  seed 재현성, 빈 DB 방어, API 기본값(`.env.local` 오버라이드 반영)·범위 검증(422).
- 프론트: `frontend/src/pages/Recommend.exclude.test.tsx` 에 '자동' 버튼 시험 추가 — 클릭 → API 호출 확인 →
  응답 번호로 교체되는지(기존 수동 선택 9 가 사라지고 응답 11·23 만 선택) 확인.
- `make test` 상당(개별 실행: `uv --directory backend run pytest`, `pnpm test -- --run`) + `ruff check` ·
  `mypy app` · `eslint src` · `tsc --noEmit`.
