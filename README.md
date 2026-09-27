# Lotto number recommender (Lotto-Rec)

로또 6/45 추첨 데이터(1~1,240회)를 **균등 k-of-N 비복원추출 영가설** 위에서 통계분석하고, 군 A(1~1,000회)→군 B(1,001회~)로 **사후 검증**하며,
통계 기반 **사용자 번호 평가·자동 추천·성과 추적**을 제공하는 개인용 로컬 웹 플랫폼.

> **스캐폴딩 정보**: `wise-dev-std` / 프로파일 `custom` (`python-fastapi` 베이스 + React SPA). 결정 요약 [CUSTOM_STACK.md](CUSTOM_STACK.md), 요구사항 [.docs/PRD.md](.docs/PRD.md), 규제 [COMPLIANCE.md](COMPLIANCE.md).

[English](README.en.md)

## 핵심 원칙 (PRD §4.11)

- 공정 추첨에서도 번호쌍 상관은 구조적으로 음수(−1/44)다. 일반 lift 의 영가설 값은 0.852 (≠1) → **설계 보정 lift** 사용.
- 보정 전 p<0.05 는 탐색 후보. 990 쌍을 탐색하면 약 50개의 우연 후보가 정상.
- 통계적 유의성 ≠ 예측력·조작·인과. **추천번호는 균등 무작위와 동일한 당첨확률**을 가지며, 차이는 검증·성과 추적 리포트로만 판단한다.

## 기술 스택

| 구분 | 도구 |
|---|---|
| Backend | Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2 + Alembic, NumPy/SciPy/pandas/statsmodels/ruptures, uv |
| Frontend | React 18 + TypeScript + Vite, Tailwind CSS, Plotly(react-plotly.js), TanStack Query, react-router, pnpm |
| 저장 | SQLite (`data/lotto.db`) + 캐시 (`data/cache/*.npy`) |
| 실행 | Makefile + honcho(`Procfile.dev`) / pm2 대안, **local 전용** |
| 시험 | pytest(+httpx, hypothesis) / vitest, 모두 `test/` |
| CI | GitHub Actions (ruff · mypy · pytest / eslint · tsc · vitest · build) |

## 사전 요구사항

Python 3.12+, [uv](https://docs.astral.sh/uv/), Node 22+, pnpm 9, GNU Make. Docker 는 선택(local 미사용).

## 빠른 시작

```bash
make preflight       # 도구 점검
make local-build     # uv sync + pnpm install, .env.local 생성(example 복사)
make db-migrate      # data/lotto.db 생성 (Alembic)
make db-seed         # .docs/lotto(~1240).xlsx 중 1~1,000회(군 A) 적재
make local-all       # backend http://127.0.0.1:8000/docs · frontend http://127.0.0.1:5173
make local-logs      # 통합 로그 (Ctrl-C 는 tail 만 종료)
make test            # pytest + vitest
make local-stop
```

Docker 로 구동(현재 환경, S7.1 — honcho 대신 컨테이너, 같은 `./data` DB 공유):

```bash
make local-stop                  # honcho 가 8000/5173 을 쓰고 있으면 먼저 정리 (또는 아래처럼 다른 포트)
make docker-all                  # 이미지 빌드 + api/web 기동. api 는 시작 시 alembic upgrade head 자동
LOTTO_DOCKER_SEED=1 make docker-all   # 빈 DB 라면 원천 xlsx 전체 적재까지
make docker-logs SVC=api         # [entrypoint] alembic upgrade head → uvicorn 확인
make docker-ps / docker-stop     # 상태 / 정리(호스트 ./data 유지)
LOTTO_BACKEND_PORT=18000 LOTTO_FRONTEND_PORT=15173 make docker-all   # honcho 와 동시 실행 시
```

첫 사용 흐름: 설정 화면에서 **분석 실행(군 A, quick)** → 검증 화면에서 **검증 실행(1,001~1,240회 replay)** → 추천/내 번호/성과 추적.
검증 실행은 군 B 실데이터를 DB 에 삽입하므로 이후 데이터는 1,240회가 된다(군 B 라벨 유지).

## Make 타겟

| 명령 | 설명 |
|---|---|
| `make preflight` | 런타임·도구 점검 (Docker 는 WARN) |
| `make local-build` | 의존성 설치 (`uv --directory backend sync`, `cd frontend && pnpm install`) |
| `make local-all` / `local-logs` / `local-stop` / `local-restart` / `local-ps` | backend+frontend 일괄 기동/로그/종료/재기동/상태 (honcho 백그라운드, `PROC_MGR=pm2` 대안, `LOCAL_INFRA=` 로 docker infra 선택) |
| `make test` / `make lint` | pytest + vitest / ruff + mypy + eslint + tsc |
| `make db-migrate` / `db-seed` / `db-reset` / `db-fresh` | Alembic 적용 / xlsx 군 A 증분 적재(`uv run python -m app.seed [--all\|--max-draw N]`) / SQLite 재생성 / reset+seed |
| `make reanalyze [PRESET=quick\|report\|deep] [COHORTS=A,B,ALL]` | **DB 파일 백업(`data/backup/lotto_<UTC>.db`) 후 군 A·B·ALL 재분석** (`python -m app.reanalyze`, trigger=reanalyze). 기존 run 은 삭제하지 않고 `LOTTO_RUN_RETENTION` 으로 정리 |
| `make docker-all` / `docker-build` / `docker-logs` / `docker-stop` / `docker-restart` / `docker-ps` | **[docker, 현재 환경]** backend(api)+frontend(web) 컨테이너 빌드·기동(백그라운드)/빌드/로그(`SVC=api\|web`)/정리/재기동/상태. `.env.local` 을 env_file·포트로 사용, `./data`(SQLite·cache·backup)·`./.docs` 볼륨 공유. **api 는 시작 시 `alembic upgrade head` 자동 실행** 후 uvicorn, `LOTTO_DOCKER_SEED=1 make docker-all` 이면 xlsx 전체 적재. web 은 Vite dev 서버가 `/api` 를 `api:8000` 으로 프록시. honcho 가 같은 포트를 쓰고 있으면 안내 후 중단(`make local-stop` 또는 `LOTTO_BACKEND_PORT=18000 LOTTO_FRONTEND_PORT=15173 make docker-all`) |
| `make docker-migrate` / `docker-seed` / `docker-reanalyze` | [docker] 컨테이너로 마이그레이션만 / 원천 xlsx 전체 적재(멱등) / DB 백업 후 재분석(`PRESET`, `COHORTS`) |
| `make <env>-*` | dev/staging/prod 컨테이너 타겟 — 표준 호환용, 본 프로젝트 미사용 |

## 환경 변수 (`.env.local`)

변수명 = 한국어 용어 직역 + `LOTTO_` 접두어. 전체 목록 `.env.local.example`, PRD §10.
우선순위(낮→높): `.env.local.example`(기본값) → `.env` → `.env.local`(사용자 값) → OS 환경변수. 값 변경 후 `make local-restart`(uvicorn reload 는 .env 를 감시하지 않음).

| 변수 | 기본 | 설명 |
|---|---|---|
| `LOTTO_NUMBER_RECOMMENDATION_COUNT` | 10 | 로또번호 추천 갯수 (1–200) |
| `LOTTO_TRAIN_END_DRAW` | 1000 | 군 A(분석) 마지막 회차. 이후 = 군 B(검증) |
| `LOTTO_SOURCE_FILE` | `".docs/lotto(~1240).xlsx"` | 원천 파일 (괄호 포함 → 따옴표 필수) |
| `LOTTO_MC_ITERATIONS` / `_REPORT` / `_DEEP` | 10000 / 100000 / 500000 | Monte-Carlo 프리셋 quick / report / deep |
| `LOTTO_SIGNIFICANCE_LEVEL` / `LOTTO_DEFAULT_CORRECTION` | 0.05 / fdr_bh | α / 기본 보정 (bonferroni·holm·fdr_bh·fdr_by) |
| `LOTTO_RANDOM_SEED` | 20260908 | 재현성 seed |
| `LOTTO_AUTO_RERUN_PRESET` | quick | 새 회차 삽입 후 자동 재분석(`off` 가능) |
| `LOTTO_RUN_RETENTION` | 20 | 분석 run 보존 개수(0=무제한). 군별 최신·활성 실험 참조 run 은 보존 |
| `LOTTO_CROSS_DRAW_LAG` | 5 | **회차간 교차 공출현 전/후 간격 L**(1–50). lag 1..L 개별 + 창 합산 분석, 경계 회차(앞·뒤 L 회)는 간격 내 가능한 쌍만 포함. 변경 후 `make local-restart` → 새 분석 run(또는 `make reanalyze`). 현재 값은 `GET /config`·설정 화면에서 확인, 회차간 연관성 화면이 run 의 L 과 다르면 안내 |
| `LOTTO_RECENT_DRAWS` | 5 | 내 번호 '저장된 번호' 타이틀 우측 **최근 당첨번호 회차 수**(1–20, S5.8). `/config` `lotto_recent_draws` 로 노출. local 은 **저장 즉시 자동 반영**(uvicorn 이 `.env.local` 감시), docker 는 `make docker-restart` |
| `LOTTO_LOTTERY_PICK_COUNT` | 5 | 내 번호 '등록된 번호로 추첨 시도'(S5.5)의 ★ 선택 개수 기본값(1–50). `/config` `lotto_lottery_pick_count` 로 노출, 화면 '선택 개수' 입력 박스로 세션 단위 수정 |
| `LOTTO_SEED_SEARCH_MAX_ITER` | 20000000 | 추천 'SEED 값 생성'(S4.13) 무작위 탐색 안전 상한(도달 시 자동 중지). `/config` `lotto_seed_search_max_iter` 로 노출 |
| `LOTTO_PRIZE_RANK3_DEFAULT` / `_RANK4_` / `_RANK5_` | 1500000 / 50000 / 5000 | 4·5등 고정 당첨금, 3등은 회차에 실제 값(총액÷당첨게임 수)이 없을 때의 기본값(성과추적; `/config` 로 결과 입력 화면에 전달) |
| `DATABASE_URL` | `sqlite:///./data/lotto.db` | 루트 기준 상대경로 → 절대경로 자동 변환 |
| `LOTTO_BACKEND_PORT` / `LOTTO_FRONTEND_PORT` | 8000 / 5173 | 127.0.0.1 바인딩 |
| `APP_NAME` | Lotto number recommender | 표시명(API title). 저장소·패키지명은 Lotto-Rec |
| `LOTTO_TIMEZONE` / `VITE_TIMEZONE` | Asia/Seoul | 표시 시간대(IANA). 저장은 UTC, API 는 `+00:00` 오프셋 포함 ISO, 프론트가 KST 로 변환·헤더에 "KST (UTC+9)" 표시 |

## API (v1, `http://127.0.0.1:8000/docs`)

| 영역 | 엔드포인트 |
|---|---|
| 설정 | `GET /api/v1/config` |
| 데이터 | `POST /data/import` (xlsx/csv 증분, `?overwrite`) · `POST /data/draws` (단일 회차, 1~5등 `prizeN`(1게임당 당첨금)·`winnersN`(당첨게임 수) 선택 입력; S1.6) · `GET /data/draws[/{n}]` · `GET /data/summary` · `GET /data/imports` |
| 분석 | `POST /analysis/runs` {cohort A\|B\|ALL, preset, alpha?, correction?, seed?, mc_iterations?, sync?} · `GET /analysis/runs[/latest\|/{id}]` · `GET /analysis/runs/{id}/{section}` (summary, frequency, frequency_bonus, global, pairs, network, itemsets, groups, temporal, **cross_draw**, winners_model, null_summary, diff_vs_previous) · `DELETE /analysis/runs/{id}` · `POST /analysis/itemsets/query` {items \| target+given} |
| 검증 | `POST /validation/runs` {strategies?, tickets_per_draw?, from_draw?, to_draw?, seed?, insert_draws, sync?} · `GET /validation/runs[/latest\|/{id}]` · `GET /validation/runs/{id}/{kind}` (meta, backtest, scoring, replication, homogeneity) |
| 추천 | `GET /recommend/strategies` · `POST /recommend` {strategy, count?, seed?, max_shared?, include_control, save} → sets[].params_used·experiment, analysis_basis, tickets[].`past_wins`(과거 1·2등 일치 회차, S4.9) · `GET /recommend/history?origin=user\|backtest\|all&limit(≤50000)&offset&strategy&batch_id&target_draw_no`(행마다 `past_wins`) · `GET /recommend/history/summary?origin=` · `POST /recommend/sequential` {strategies?, count?, seed?, max_shared?, save} → **모든 전략 순차 생성**(카탈로그 순, 전략별 batch, control 미포함, 실패 전략은 `failed` 로 계속·보고; S4.11) · `DELETE /recommend/history[?target_draw_no=]` → **추천 초기화**(진행 예정 회차=최신+1 의 origin=user 추천 삭제, 결과 입력된 회차는 400; S4.12) · `POST /recommend/auto-register` {target_draw_no?, seed?} → 1..P 중 5개 무작위 추출 × 대상 회차 수 → 빈도 상위 5 위치의 전략별 최신 batch 티켓을 내 번호로 등록(같은 번호·회차는 ★ 중복 병합 → `merged_duplicates`/`total_merged`, S4.10·S5.6). `exclude_numbers?`(1~45) 로 넘긴 번호가 포함된 (전략,위치) 조합은 등록하지 않고 응답 `excluded_positions` 로 보고(대체 없이 skip; v1.28). 같은 제외 번호 선택(화면 전역 공유)은 `POST /recommend`·`POST /recommend/sequential` 에도 `exclude_numbers?` 로 적용되어 해당 번호가 포함된 조합을 생성하지 않는다(거부 표본추출; v1.29). 추천 개수 상한은 200(`count?`) · `POST /recommend/seed-search` {target_draw_no?, target_rank?} → **SEED 값 생성**(대상 회차 직전 실제 회차 1등 번호 기준 무작위 탐색, 백그라운드·미저장) → {job_id, status, iterations, seed, matched_strategy, matched_ticket, max_iterations} · `GET /recommend/seed-search/{job_id}`(진행 폴링) · `POST /recommend/seed-search/{job_id}/stop`(중지) · **일치(`status:"done"`) 시 `.env.local` 의 `LOTTO_RANDOM_SEED` 를 그 seed 로 자동 갱신**(`env_updated`)해 다음에도 기본값으로 계속 쓰이게 함 · '추천 생성'·'추천 생성(순차)'는 **'seed 신규' 체크박스**(기본 해제)가 체크됐을 때만 SEED 탐색이 완료돼 있지 않으면 탐색을 (재)시작해 완료되는 즉시 자동 생성하고, 해제(기본) 상태거나 이미 완료돼 있으면 즉시 생성한다. 체크 상태로 대기 중 'SEED 생성 중지'를 누르면 생성을 취소하지 않고 탐색 시작 전 seed 값으로 진행한다(S4.13) |
| 실험(전략 개선 루프) | `GET /experiments/strategy-params` · `POST /experiments/runs` {strategy, base_params?, search random\|coordinate, n_candidates, tune_from/to, holdout_from/to, tickets_per_draw, seed, sync} · `GET /experiments/runs[?strategy]` · `GET /experiments/runs/{id}` · `GET /experiments/lineage?strategy=` · `GET /experiments/active` · `POST /experiments/runs/{id}/activate` · `POST /experiments/deactivate?strategy=` · `DELETE /experiments/runs/{id}` |
| 사용자 | `POST /user/tickets/evaluate` · `POST /user/tickets`(같은 번호·대상 회차가 이미 있으면 새 행 없이 병합: `dup_count`+1·`dup_labels` 누적, S5.6) · `GET /user/tickets?target_draw_no=`(회차 필터 S5.7; 행마다 `dup_count`·`dup_labels`·`same_number_ticket_ids`·`duplicate`) · '번호 선택'에서 '평가' 클릭 시 아래 목록을 대상 회차 기준 **추첨 결과 순**(1등→5등→낙첨→대기)으로 재정렬(표시 전용, 회차 필터 변경·초기화 시 해제; S5.11) · `DELETE /user/tickets?target_draw_no=`(필수) → **내 번호 초기화**(진행 예정 회차 번호만 삭제, 결과 입력된 회차는 400; S5.9) · `GET /user/tickets/draws`(**현재 대상 회차** 컨텍스트: next_draw·latest_result_draw·active_target_draw·reason·draws[{target_draw_no,count,evaluated}] — 다음 회차 추천 저장/등록 시 next, 아니면 최근 등록 회차) · `DELETE /user/tickets/{id}` |
| 성과 추적 | `GET /tracking/summary?origin=user\|backtest` · `GET /tracking/consistency?origin=&source=&strategy=` → **추천 정합성 분석**(전략별 등수 분포·일치수 GOF·번호 상관·번호쌍 상관, BH 보정 q·`feedback`·`next_experiment`; S8.7) · `GET /tracking/outcomes?draw_no&strategy&source&origin&limit(≤50000)&offset`(행마다 `past_wins`) · `GET /tracking/outcomes/summary` · `GET /tracking/pending` · `POST /tracking/evaluate/{draw_no}` |

예시 (군 A 분석, 실제 응답 요약):

```bash
curl -s -X POST localhost:8000/api/v1/analysis/runs -H 'content-type: application/json' \
  -d '{"cohort":"A","preset":"quick"}'          # → {"run_id":"…","status":"pending",…} (약 20초 후 done)
curl -s localhost:8000/api/v1/analysis/runs/<run_id>/summary | jq .kpi
# {"global_p_joe":0.888,"global_p_mc":0.889,"order_stat_p":0.341,"n_sig_numbers_bh":0,"n_sig_pairs_bh":0,
#  "n_sig_pairs_fwer":0,"max_pair":[11,21],"max_pair_z":3.07,"max_pair_p_maxT":0.972,"genest_p_mc":0.926,…}
```

## 통계 엔진 개요 (PRD §4)

| 모듈 | 내용 |
|---|---|
| `core/null_model.py` | 조합 확률 $(k)_r/(N)_r$, 설계 보정 lift, Joe 계수, Genest 가중치, 순서통계량 μ·V, 일치수·등수 확률, 벡터화 MC 시뮬레이터 |
| `core/frequency.py` | 번호별 정확 이항검정·z·예측구간, Pearson X²(참고)·**Joe J**·G-test·MC p |
| `core/order_stats.py` | Coronel-Brizio et al.(2008) 정렬 결과벡터 Q ~ χ²_k |
| `core/pairs.py` | 990쌍 공출현·Lift*·z·양측 이항 p·Bonferroni/Holm/BH/BY·**maxT FWER**·Genest 쌍 X²·네트워크 엣지 |
| `core/itemsets.py` | 3-집합 후보(상위 쌍×제3번호)·조건부 P(1\|2,3)·집합쌍 (1,2)→(3,4) |
| `core/groups.py` | 홀짝·저고·구간·생일수·소수 = 하이퍼지오메트릭, 합·연속·끝수·범위·AC = MC 영분포, 전형성(마할라노비스) |
| `core/temporal.py` | 인접 중복수, lag 1~10 자기상관 + maxT, runs, gap KS, Ljung–Box, CUSUM(MC)·PELT |
| `core/cross_draw.py` | **회차간 교차 공출현(S2.13)**: 전회차 번호 i → 후회차 번호 j 45×45 방향 행렬(대각 = 재출현), lag 1..L 개별 + 창 합산, 영가설 셀 확률 (k/N)², **주변빈도 조건부 2×2 독립성 z**(자주 나온 번호의 셀 부풀림 제거)·정규근사 p·BH/BY·MC maxT(lag별·창·전 lag), 경계 회차 부분 포함 커버리지 |
| `core/winners_model.py` | 조합 특성 → 1등 당첨자수 음이항 회귀(+VIF), 저경쟁 조합 예측 |
| `core/mc_engine.py` | 한 번의 시뮬레이션 패스로 모든 영분포 수집 (quick 10k ≈ 20s; 교차 공출현 maxT 포함 시 ≈ 50s) |
| `core/recommend/` | 9 전략(가중 비복원 A-Res, 쌍 순차, 전형성 필터, 저경쟁, **군 A 분석 가중**), 파라미터 스키마·병합, 스코어카드 |
| `services/experiment_service.py` | **전략 개선 루프**: K 후보 → 튠 B₁ replay → 최고 선택 → 홀드아웃 B₂ → best-of-K 영분포·optimism·계보 Spearman·활성화 (PRD §4.12, §E9) |

## 검증 결과 요약 (2026-09-08, PRD §17)

- 군 A·B·전체 모두 균등 영가설과 일치 (J p = 0.888 / 0.393 / 0.877, maxT·Genest·CUSUM 모두 비유의).
- **재분석(2026-09-14, 1,241회 포함, PRD §17.5)**: 군 A(1~1,000)·B(1,001~1,241)·전체(1~1,241) J p = 0.888 / 0.396 / 0.874, **회차간 교차 공출현(창 1..5)** 최대 셀 maxT p = 0.087 / 0.396 / 0.125, FWER 유의 셀 0, 재출현 z = 0.70 / −1.77 / 0.27 — 전/후 회차 번호 사이에 의존성 증거 없음.
- Replay backtest 1,001~1,240회 × 8전략 × 10장: **모든 전략 "균등과 차이 없음"**, 1~3등 0건, 재현율 0/29(H0 기대 2.5%).
- 전략 개선 루프(`analysis_weighted`, K=8, 튠 1,001~1,120 → 홀드아웃 1,121~1,240): 튠 최고 diff +0.007(H0 best-of-8 기대 +0.046) → 홀드아웃 −0.021, 2세대 +0.025 → −0.058. **개선은 홀드아웃에서 소멸(평균 회귀)** — PRD §17.4.

## 테스트

**수동 curl 시나리오**: `scripts/recommend-flow.sh` — 제외 번호 → SEED 값 생성 → 추천 생성(순차) 3단계를 curl 로 재현하는 간단한 스크립트(`./scripts/recommend-flow.sh --help`). SEED 값 생성에는 제외 번호를 적용하지 않는다(S4.13 v1.30).

| 차수 | 범위 | 결과 |
|---|---|---|
| dev-env | 표준 환경 | PASS (1건 수정: `.env.local` 괄호 경로 인용) |
| impl/1st | E1 데이터·증분 import | PASS 8/8 |
| impl/2nd | E2 통계 엔진 (이론값·기각률·run) | PASS 12/12 |
| impl/3rd | E3/E4/E5/E8 검증·추천·추적 | PASS 13/13 (round 2) |
| impl/4th | E6 대시보드 (10화면) | PASS 12/12 (round 3, 라이브 스크린샷 6·콘솔 오류 0) |
| impl/5th | S4.6 추천 이력 필터·전체 조회 + S4.7 추천→내 번호 등록 | PASS 10/10 (pytest 42, vitest 16) |
| impl/6th | E9 전략 개선 루프(시뮬레이션 실험) + S4.8 추천 근거 표시 | PASS 12/12 (pytest 50, vitest 18) |
| impl/7th | 추천 이력 출처 필터(사용자/검증 replay/전체) — "전체인데 20건" 보고 대응 | PASS 6/6 (pytest 51, vitest 18) |
| impl/8th | S8.4 run 차이 요약 · Q5 run 보존 · §12.2 편향 검정력 | PASS 5/5 (pytest 54, vitest 18) |
| impl/9th | 공통 UX: 폼 정렬(Field 3줄 고정) · 표시명 2줄 · 플로팅 테마 메뉴 | PASS 6/6 (vitest 21) |
| impl/10th | S8.6 성과 추적 티켓 결과 필터(회차·전략·출처·표시 개수) | PASS 5/5 (pytest 55, vitest 22) |
| impl/11th | 용어 툴팁(`Term`, 65 용어·165 적용)·용어 사전 `/glossary` | PASS 5/5 (vitest 28) |
| impl/12th | 표시 시간대 KST(`LOTTO_TIMEZONE`, `to_iso`) | PASS 6/6 (pytest 56) |
| impl/13th | OpenAPI 계약 테스트(42 경로 스냅샷·응답 형태) · PRD 수용기준/로드맵 현황 | PASS 4/4 (pytest 59) |
| impl/14th | S4.9 추천 티켓의 과거 1·2등 일치 회차 `(386)` 표시(추천 카드·이력·성과추적 티켓 열, 작은 회색 글씨) | PASS 5/5 (pytest 61, vitest 30) |
| impl/15th | S4.10 추천 이력 '내 번호로 자동 등록'(무작위 빈도 상위 5 위치 → 전략별 최신 batch 티켓 등록, `POST /recommend/auto-register`) | PASS 5/5 (pytest 62, vitest 31) |
| impl/16th | S4.7/S4.10 UX — 자동 등록 규칙은 버튼 툴팁만, 추천 이력 행 '내 번호로 등록'은 확인 팝업 없이 즉시 | PASS 4/4 (pytest 62, vitest 31) |
| impl/17th | S5.5 내 번호 '등록된 번호로 추첨 시도' — 1..N(저장 개수) 무작위 빈도 규칙(`lib/lottery.ts`)으로 5장 ★ 표시, DB 저장 없음 | PASS 6/6 (pytest 62, vitest 34) |
| impl/18th | S5.6 내 번호 **★ 중복 ×n 표시** — 같은 번호·회차 등록은 병합(`user_ticket.dup_count/dup_labels`, Alembic 5b12a3e1), 다른 회차 동일 번호는 `same_number_ticket_ids` 로 묶음, 자동 등록 skip→merge, 용어 `duplicate_ticket`(중복 생성 ≠ 유의성 증거) | PASS 8/8 (pytest 63, vitest 35) |
| impl/19th | 버그 수정 — 내 번호 보너스 포함 평가 시 백색 화면(스코어카드 `bonus` dict → int, `bonus_info` 분리, ScorecardView 방어 렌더) | PASS 4/4 (pytest 63, vitest 37) |
| impl/20th | 버그 수정 — `.env.local` 값 미적용(pydantic-settings `env_file` 뒤 파일 우선 → example 이 덮어씀; 순서 example → `.env` → `.env.local` 로 수정, 우선순위 회귀 테스트) | PASS 6/6 (pytest 65, vitest 37) |
| impl/48th | v1.30 **SEED 값 생성은 제외 번호 미적용** 명문화(구조적 보증 테스트 추가) + `scripts/recommend-flow.sh`(제외 번호 → SEED 값 생성 → 추천 생성(순차) curl 시나리오) | PASS 6/6 (pytest 121) |
| impl/47th | v1.29 **제외 번호를 추천 생성에도 적용 + 추천 개수 200 상한** — 제외 번호 그리드를 '전략 선택'의 '군 A 분석 가중' 카드 우측으로 이동해 '추천 생성'·'추천 생성(순차)'·'내 번호로 자동 등록' 셋 모두에 공유 적용(거부 표본추출). 추천 개수 상한 50 → 200 | PASS 8/8 (pytest 119, vitest 94) |
| impl/46th | v1.28 **자동 등록 제외 번호** — 추천 이력 필터 바와 이력 표 사이에 1~45 제외 번호 그리드(내 번호 평가와 동일 UI) 추가. 선택한 번호가 포함된 조합은 '내 번호로 자동 등록' 대상에서 제외(대체 없이 skip) | PASS 7/7 (pytest 106, vitest 91) |
| impl/45th | v1.27 **평가 클릭 시 저장 목록 결과순 정렬** — '번호 선택'에서 '평가'를 누르면 '저장된 번호' 목록을 대상 회차 기준 추첨 결과 순(1등→5등→낙첨→대기)으로 재정렬(표시 전용), 회차 필터 변경·초기화 시 해제 | PASS 6/6 (vitest 87) |
| impl/44th | v1.26 **'seed 신규' 체크박스** — '추천 생성'·'추천 생성(순차)'가 매번 SEED 탐색을 강제하던 문제를 방지(기본 해제 시 현재 seed 값으로 즉시 생성), 체크 시에만 탐색 자동 연계, 'SEED 생성 중지' 시 생성을 취소하지 않고 기존 seed 값으로 진행 | PASS 7/7 (vitest 83) |
| impl/43rd | v1.25 **추천 생성 폼 버튼 우측 정렬** — '추천 생성'·'추천 생성(순차)' 버튼 묶음을 폼 행 우측 끝에 맞춤(`ml-auto`), 입력란·체크박스는 좌측에 촘촘히 유지 | PASS 3/3 (pytest 104, vitest 81) |
| impl/42nd | v1.24 **SEED 완료 시 .env.local 자동 갱신 + 추천 생성 자동 연계** — 일치하면 `LOTTO_RANDOM_SEED` 를 즉시 갱신(다음에도 기본값), '추천 생성'·'추천 생성(순차)'는 완료돼 있으면 즉시·아니면 탐색 후 자동 생성. **사고**: 테스트가 실 `.env.local` 을 오염시켜 즉시 복원 + autouse 격리 픽스처 추가 | PASS 8/8 (pytest 104, vitest 80) |
| impl/41st | v1.23 **추천 생성 폼 레이아웃 압축** — 입력란 간 간격 최소화(flex-wrap, 값 크기에 맞춘 폭), '균등 기준선 동시 생성'·'저장 (성과 추적)' 체크박스 한 줄 표시, 버튼 우측 여백 제거 | PASS 6/6 (vitest 77) |
| impl/40th | v1.22 **SEED 값 생성** — seed 입력칸 우측 버튼으로, 대상 회차 직전 실제 회차의 1등 번호(보너스 제외)와 같아질 때까지 무작위 전략·조합을 반복해 시행 횟수를 seed 로 채움. 희망 등수 선택(기본 1등)·중지 버튼·상한(`LOTTO_SEED_SEARCH_MAX_ITER`), 폼 필드 재배치 | PASS 6/6 (pytest 97, vitest 76) |
| impl/39th | v1.21 **추첨 개수 `.env` 관리** — `LOTTO_LOTTERY_PICK_COUNT`(기본 5) + '등록된 번호로 추첨 시도' 앞 입력 박스, 추첨 시도 결과 문구를 테두리 범례 우측 같은 줄로 | PASS 5/5 (pytest 91, vitest 70) |
| impl/38th | S5.10 **추첨 시도 표시 개선** — ★ 티켓 목록 상단 정렬, ★ 티켓 번호 중 최근 6회차 1등 번호와 겹치는 번호에 출현 횟수별 테두리(흰 안쪽 링 + 1회 검정/2회 노랑/3회 파랑/4회 빨강/5회 회색/6회 초록) + 범례 | PASS 6/6 (vitest 66) |
| impl/37th | v1.19 **방어 코드** — 추천 초기화·내 번호 초기화·추천 자동 등록은 결과가 입력되지 않은 진행 예정 회차에서만(API 400, 버튼 비활성+사유 툴팁), 성과 추적의 중복 '추첨 결과 입력 / 업로드' 섹션 주석 처리로 숨김 | PASS 8/8 |
| impl/36th | S1.7 **결과 입력 옆 과거 6회차 요약** — '추첨 결과 직접 입력' 제목 우측 회차 칩(1242…1237), 마우스 오버/포커스 툴팁 표(당첨번호·등위별 총 당첨금·당첨게임 수·1게임당 당첨금), 기존 `GET /data/draws` 재사용 | PASS 5/5 (vitest 59) |
| impl/35th | S1.6 v1.17 **등위별 총 당첨금 입력·자동계산** — 1~3등 총액÷당첨게임 수 → 1게임당 당첨금, 4·5등 고정값(50,000·5,000) 유지, 등수 5열 전폭 표, 데이터 요약 강조·입력/업로드 패널 구분, 업로드 안내 문구 버튼 우측 | PASS 7/7 (vitest 56) |
| impl/34th | S8.7~S8.9 **추천 정합성 분석** — 추천 티켓 전체 vs 실제 결과(등수 분포·일치수 GOF·번호 상관·번호쌍 상관, BH 보정, 재튜닝 제안), 성과 추적 화면 섹션, `GET /tracking/consistency` | PASS 8/8 (pytest 88, vitest 54) |
| impl/33rd | S1.6 **설정/실행 결과 입력 재구성** — 직접 입력·파일 업로드 상하 배치, 업로드 도구 한 줄, 1~5등 당첨게임 수·1게임당 당첨금 입력(`draws.prize3..5/winners3..5`, Alembic c41d7a92) | PASS 6/6 (pytest 88, vitest 54) |
| impl/32nd | 사용자 요청 — **추천 초기화**(현재 회차 추천 삭제, S4.12)·**내 번호 초기화**(표시 중 대상 회차 삭제, S5.9) 버튼, 버튼 한 줄 배치 | PASS 7/7 (pytest 79, vitest 49) |
| impl/31st | 사용자 보고 "`LOTTO_RECENT_DRAWS` 수정해도 미적용" — uvicorn `--reload` 가 `backend/*.py` 만 감시. Procfile `--reload-dir .. --reload-include .env.local`(frontend/data/test 제외)로 **`.env` 저장 즉시 재기동**(1초 내 반영 확인). `make local-restart` 포트 경쟁(`Address already in use`) 수정 | PASS 4/4 |
| impl/30th | S5.8 최근 당첨번호 **2열 그리드**(`grid-cols-[repeat(2,max-content)]`, 라벨 줄바꿈 금지, 우측 도구 `shrink-0`) — 3열은 1280px 에서 우측 도구와 겹쳐 사용자 결정 2열 | PASS 3/3 (pytest 76, vitest 46) |
| impl/29th | S5.8 최근 당첨번호 회차 수 **`.env` 관리** — `LOTTO_RECENT_DRAWS`(기본 5, 1–20) → `/config` `lotto_recent_draws` → 내 번호 화면(config 로드 후 1회 요청), 설정 화면 설명·계약 테스트 | PASS 5/5 (pytest 76, vitest 46) |
| impl/28th | S5.8 **저장된 번호 헤더 정렬·최근 당첨번호** — '대상 회차' 필터·'등록된 번호로 추첨 시도' 버튼을 우측 세로 2줄로, 타이틀 우측에 최신 5회차 당첨번호(`GET /data/draws?limit=5&order=desc`, 표시 전용; Section `aside` 슬롯) | PASS 6/6 (pytest 76, vitest 46) |
| impl/27th | S7.1 **docker compose 구동** — Dockerfile 정비(lock 고정·`.dockerignore`·`/srv/lotto` 루트), api 엔트리포인트 `alembic upgrade head`(선택 시드) → uvicorn, web Vite 프록시 → `api:8000`, `make docker-*` 9종. 실측: 빌드·기동(18000/15173) → 마이그레이션 로그·health·API(1,241회)·프론트 프록시 OK, 빈 DB 마이그레이션 3단계 적용, honcho 충돌 안내 | PASS 8/8 (pytest 76, vitest 45) |
| impl/26th | UI 수정 — '추천 생성'·'추천 생성(순차)' 두 줄 표시 → 버튼 슬롯 2열·줄바꿈 금지로 한 줄 배치 | PASS 3/3 (vitest 45) |
| impl/25th | S4.11 **추천 생성(순차)** — '추천 생성' 우측 버튼, 전략 선택의 모든 전략을 순서대로 같은 옵션으로 생성(전략별 batch, `POST /recommend/sequential`), 전략별 결과 섹션 + 요약 | PASS 5/5 (pytest 76, vitest 45) |
| impl/24th | 사용자 보고 "회차간 상관분석 .env 변수 미적용" — 엔진 적용은 정상, `/config`·설정 화면 미노출이 원인. `lotto_cross_draw_lag`·`lotto_min_effect_delta`·`lotto_run_retention` 노출, 회차간 연관성 화면 설정/run L 불일치 안내 | PASS 5/5 (pytest 74, vitest 44) |
| impl/23rd | S5.7 **저장된 번호 회차 전환·필터** — 추첨 결과 등록 직후엔 기존 번호·낙첨 결과 유지, **다음 회차 추천을 저장하면** 목록이 다음 회차로 전환(이전 회차는 숨김·삭제 아님), 회차 필터(자동/특정/전체), `GET /user/tickets/draws` | PASS 6/6 (pytest 74, vitest 42) |
| impl/22nd | 버그 수정 — 용어 툴팁이 박스를 벗어남(표 헤더 `whitespace-nowrap` 상속 → 툴팁 `whitespace-normal break-words` + 뷰포트 폭 상한) | PASS 3/3 (vitest 40) |
| impl/21st | S2.13 **회차간 교차 공출현**(전회차 i→후회차 j 45×45, lag 1..L 개별+창, 조건부 독립성 z·MC maxT, 경계 회차 부분 포함) · `LOTTO_CROSS_DRAW_LAG` · 화면 `/cross-draw` · `make reanalyze`(백업 후 군 A/B/ALL 재분석, 1,241회 포함) | PASS 11/11 (pytest 72, vitest 39) |

```bash
make test                      # 전체
uv --directory backend run pytest -q   # backend 만 (76 tests)
cd frontend && pnpm test -- --run   # frontend 만
```

## 디렉터리 구조

```
Lotto-Rec/
├── .docs/                # PRD.md(단일 원본), Perplexity 조사문서, lotto(~1240).xlsx
├── backend/
│   ├── app/{main.py, api/, core/, core/recommend/, services/, db/, schemas/, seed.py, reanalyze.py}
│   ├── alembic/versions/ alembic.ini pyproject.toml uv.lock Dockerfile docker-entrypoint.sh .dockerignore
├── frontend/src/{pages,components,api,hooks,lib}/
├── test/{dev-env, impl/<Nth>, backend}/
├── data/                 # lotto.db, cache/, backup/ (git 제외; backup 은 make reanalyze 가 생성)
├── Makefile Procfile.dev ecosystem.config.cjs docker-compose.yml
└── .env.local(.example)  CUSTOM_STACK.md  COMPLIANCE.md
```

## 트러블슈팅

| 증상 | 원인 / 조치 |
|---|---|
| `./.env.local: syntax error near unexpected token '('` | `LOTTO_SOURCE_FILE` 값의 괄호 — 따옴표로 감싼다 |
| `make db-seed` 가 0건 삽입 | 이미 적재됨(멱등). 군 B 까지 적재하려면 `uv --directory backend run python -m app.seed --all` |
| 분석 run 이 `running` 에서 오래 머묾 | deep 프리셋(500k) 은 15분 이상. `GET /analysis/runs/{id}` 로 progress 확인 |
| 추천이 `fallback: winners_model 없음` | 완료된 군 A 분석 run 이 없음 → 먼저 분석 실행 |
| Tailwind 설정(darkMode 등) 변경 후 화면 반영 안 됨 | Vite dev 서버가 tailwind.config 를 시작 시 로드 → `make local-restart` |
| 추천 이력이 "전체"인데 건수가 적음 | 이력 기본 출처 = 사용자 생성(저장 체크한 추천만). 검증 replay 가 만든 시뮬레이션 티켓은 출처 필터를 "검증 replay" 또는 "전체"로 |
| `LOTTO_CROSS_DRAW_LAG` 를 바꿨는데 회차간 연관성 화면이 그대로 / 설정 화면에 안 보임 | 간격은 run 생성 시점에 고정됨(섹션 `max_lag`). 순서: `.env.local` 수정(local 은 저장 즉시 backend 자동 재기동, v1.14.3; docker 는 `make docker-restart`) → 설정 화면 `lotto_cross_draw_lag` 값 확인 → 새 분석 run 또는 `make reanalyze`. 회차간 연관성 화면은 run 의 L 과 현재 설정 L 이 다르면 파란 안내를 띄움(v1.11.1) |
| 회차간 연관성에서 어떤 번호의 대각(재출현) 셀만 크게 보임 | 해당 번호의 전체 출현 빈도가 높은 효과. 표시·판정에 쓰는 z 는 주변빈도 **조건부** 독립성 z 라 부풀려지지 않음(무조건 기대는 참고 열 `기대(H0)`) |
| 추첨 결과 등록 후 '내 번호' 저장 목록이 비어 보임 | S5.7 설계: 다음 회차 추천을 저장(또는 다음 회차 번호 등록)한 순간 목록이 다음 회차로 전환됨. 이전 회차 번호는 삭제되지 않음 — '대상 회차' 필터에서 해당 회차 또는 '전체 회차' 선택 |
| 표 헤더의 (?) 툴팁 글이 박스 밖으로 한 줄로 흘러나감 | `DataTable` th/td 의 `whitespace-nowrap` 이 툴팁에 상속됨. v1.10.1 에서 `Term` 툴팁에 `whitespace-normal break-words`·`max-w-[calc(100vw-2rem)]` 강제 — 줄바꿈되며 세로 크기는 자동 |
| Docker 없음 경고 | local 전용(SQLite)이라 무시 가능(`make local-all` 은 Docker 불필요). `make docker-*` 만 Docker 필요 |
| `make docker-all` 이 "honcho 가 실행 중" 으로 중단 | 같은 포트(8000/5173) 충돌 방지. `make local-stop` 후 실행하거나 `LOTTO_BACKEND_PORT=18000 LOTTO_FRONTEND_PORT=15173 make docker-all` |
| 컨테이너 api 가 `.env.local` 값을 못 읽음 / 경로 오류 | compose 가 `.env.local` 을 env_file 로 주입(따옴표 값 정상 처리). 컨테이너 루트는 `/srv/lotto`(DB `./data/lotto.db` → `/srv/lotto/data/lotto.db`). 값 변경 후 `make docker-restart SVC=api` |
| web 컨테이너에서 API 호출 실패 | web 은 Vite dev 서버가 `/api` 를 `VITE_API_BASE=http://api:8000` 으로 프록시. api healthcheck 통과 후 기동(`depends_on: service_healthy`) — `make docker-logs SVC=api` 로 alembic/uvicorn 확인 |
| `This project is configured to use 9.9.0 of pnpm` | `packageManager` 핀 ≠ 전역 pnpm. 반드시 `frontend/` 안에서 `pnpm …` 실행(Makefile·Procfile 은 `cd frontend &&` 사용). 또는 핀을 설치 버전으로 변경 |
| **보너스 포함 평가 후 백색 화면** | 스코어카드 응답 `bonus` 가 객체로 내려와 `BallRow` 가 객체를 렌더 → React 크래시. v1.9.1 에서 `bonus` int\|null + `bonus_info` 분리, 프론트 방어 렌더 |
| **`.env.local` 값(예: `LOTTO_NUMBER_RECOMMENDATION_COUNT=20`)이 적용 안 됨** | pydantic-settings 는 `env_file` 튜플의 **뒤 파일이 우선**인데 `.env.local.example` 이 뒤에 있어 기본값이 항상 승리했음. v1.9.2 에서 순서를 example → `.env` → `.env.local` 로 수정. 파일 변경은 uvicorn reload 대상이 아니므로 `make local-restart` 필요 |
| 1241·1242회 당첨금이 실제보다 크게 보임 | 과거 수동 입력 때 '1등 당첨금' 칸에 등위별 **총** 당첨금을 넣었던 것(xlsx 시드는 1게임당). 2026-09-21 총액÷당첨자 수로 정정 완료(백업 `data/backup/lotto_pre_prizefix_*.db`). 입력 라벨은 '1게임당 당첨금'(v1.16) |

## 다음 단계 / 잔여

- Q4(3~5등 고정 당첨금)는 v1.16 부터 회차별 실제 값(입력 시)을 우선 사용, 미입력 회차는 env 기본값. Q5(run 보존 개수)는 env 기본값으로 잠정 확정.
- Playwright 스모크(P2) — 브라우저 바이너리 다운로드 필요, 미착수(대체: browse 라이브 스크린샷).
- API 경로 변경 시 `test/backend/openapi_paths.snapshot.json` 의도적 갱신 필요.
- 선택: `/wise-dev-std:review`(코드 리뷰), `/wise-dev-std:standardize`(IDE 규칙).
