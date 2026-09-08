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
| `make <env>-*` | dev/staging/prod 컨테이너 타겟 — 표준 호환용, 본 프로젝트 미사용 |

## 환경 변수 (`.env.local`)

변수명 = 한국어 용어 직역 + `LOTTO_` 접두어. 전체 목록 `.env.local.example`, PRD §10.

| 변수 | 기본 | 설명 |
|---|---|---|
| `LOTTO_NUMBER_RECOMMENDATION_COUNT` | 10 | 로또번호 추천 갯수 (1–50) |
| `LOTTO_TRAIN_END_DRAW` | 1000 | 군 A(분석) 마지막 회차. 이후 = 군 B(검증) |
| `LOTTO_SOURCE_FILE` | `".docs/lotto(~1240).xlsx"` | 원천 파일 (괄호 포함 → 따옴표 필수) |
| `LOTTO_MC_ITERATIONS` / `_REPORT` / `_DEEP` | 10000 / 100000 / 500000 | Monte-Carlo 프리셋 quick / report / deep |
| `LOTTO_SIGNIFICANCE_LEVEL` / `LOTTO_DEFAULT_CORRECTION` | 0.05 / fdr_bh | α / 기본 보정 (bonferroni·holm·fdr_bh·fdr_by) |
| `LOTTO_RANDOM_SEED` | 20260908 | 재현성 seed |
| `LOTTO_AUTO_RERUN_PRESET` | quick | 새 회차 삽입 후 자동 재분석(`off` 가능) |
| `LOTTO_RUN_RETENTION` | 20 | 분석 run 보존 개수(0=무제한). 군별 최신·활성 실험 참조 run 은 보존 |
| `LOTTO_PRIZE_RANK3_DEFAULT` / `_RANK4_` / `_RANK5_` | 1500000 / 50000 / 5000 | 3·4·5등 고정 당첨금(가정값, 성과추적) |
| `DATABASE_URL` | `sqlite:///./data/lotto.db` | 루트 기준 상대경로 → 절대경로 자동 변환 |
| `LOTTO_BACKEND_PORT` / `LOTTO_FRONTEND_PORT` | 8000 / 5173 | 127.0.0.1 바인딩 |
| `APP_NAME` | Lotto number recommender | 표시명(API title). 저장소·패키지명은 Lotto-Rec |
| `LOTTO_TIMEZONE` / `VITE_TIMEZONE` | Asia/Seoul | 표시 시간대(IANA). 저장은 UTC, API 는 `+00:00` 오프셋 포함 ISO, 프론트가 KST 로 변환·헤더에 "KST (UTC+9)" 표시 |

## API (v1, `http://127.0.0.1:8000/docs`)

| 영역 | 엔드포인트 |
|---|---|
| 설정 | `GET /api/v1/config` |
| 데이터 | `POST /data/import` (xlsx/csv 증분, `?overwrite`) · `POST /data/draws` (단일 회차) · `GET /data/draws[/{n}]` · `GET /data/summary` · `GET /data/imports` |
| 분석 | `POST /analysis/runs` {cohort A\|B\|ALL, preset, alpha?, correction?, seed?, mc_iterations?, sync?} · `GET /analysis/runs[/latest\|/{id}]` · `GET /analysis/runs/{id}/{section}` (summary, frequency, frequency_bonus, global, pairs, network, itemsets, groups, temporal, winners_model, null_summary, **diff_vs_previous**) · `DELETE /analysis/runs/{id}` · `POST /analysis/itemsets/query` {items \| target+given} |
| 검증 | `POST /validation/runs` {strategies?, tickets_per_draw?, from_draw?, to_draw?, seed?, insert_draws, sync?} · `GET /validation/runs[/latest\|/{id}]` · `GET /validation/runs/{id}/{kind}` (meta, backtest, scoring, replication, homogeneity) |
| 추천 | `GET /recommend/strategies` · `POST /recommend` {strategy, count?, seed?, max_shared?, include_control, save} → sets[].params_used·experiment, analysis_basis · `GET /recommend/history?origin=user\|backtest\|all&limit(≤50000)&offset&strategy&batch_id&target_draw_no` · `GET /recommend/history/summary?origin=` |
| 실험(전략 개선 루프) | `GET /experiments/strategy-params` · `POST /experiments/runs` {strategy, base_params?, search random\|coordinate, n_candidates, tune_from/to, holdout_from/to, tickets_per_draw, seed, sync} · `GET /experiments/runs[?strategy]` · `GET /experiments/runs/{id}` · `GET /experiments/lineage?strategy=` · `GET /experiments/active` · `POST /experiments/runs/{id}/activate` · `POST /experiments/deactivate?strategy=` · `DELETE /experiments/runs/{id}` |
| 사용자 | `POST /user/tickets/evaluate` · `POST /user/tickets` · `GET /user/tickets` · `DELETE /user/tickets/{id}` |
| 성과 추적 | `GET /tracking/summary?origin=user\|backtest` · `GET /tracking/outcomes?draw_no&strategy&source&origin&limit(≤50000)&offset` · `GET /tracking/outcomes/summary` · `GET /tracking/pending` · `POST /tracking/evaluate/{draw_no}` |

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
| `core/winners_model.py` | 조합 특성 → 1등 당첨자수 음이항 회귀(+VIF), 저경쟁 조합 예측 |
| `core/mc_engine.py` | 한 번의 시뮬레이션 패스로 모든 영분포 수집 (quick 10k ≈ 20s) |
| `core/recommend/` | 9 전략(가중 비복원 A-Res, 쌍 순차, 전형성 필터, 저경쟁, **군 A 분석 가중**), 파라미터 스키마·병합, 스코어카드 |
| `services/experiment_service.py` | **전략 개선 루프**: K 후보 → 튠 B₁ replay → 최고 선택 → 홀드아웃 B₂ → best-of-K 영분포·optimism·계보 Spearman·활성화 (PRD §4.12, §E9) |

## 검증 결과 요약 (2026-09-08, PRD §17)

- 군 A·B·전체 모두 균등 영가설과 일치 (J p = 0.888 / 0.393 / 0.877, maxT·Genest·CUSUM 모두 비유의).
- Replay backtest 1,001~1,240회 × 8전략 × 10장: **모든 전략 "균등과 차이 없음"**, 1~3등 0건, 재현율 0/29(H0 기대 2.5%).
- 전략 개선 루프(`analysis_weighted`, K=8, 튠 1,001~1,120 → 홀드아웃 1,121~1,240): 튠 최고 diff +0.007(H0 best-of-8 기대 +0.046) → 홀드아웃 −0.021, 2세대 +0.025 → −0.058. **개선은 홀드아웃에서 소멸(평균 회귀)** — PRD §17.4.

## 테스트

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

```bash
make test                      # 전체
uv --directory backend run pytest -q   # backend 만 (41 tests)
cd frontend && pnpm test -- --run   # frontend 만
```

## 디렉터리 구조

```
Lotto-Rec/
├── .docs/                # PRD.md(단일 원본), Perplexity 조사문서, lotto(~1240).xlsx
├── backend/
│   ├── app/{main.py, api/, core/, core/recommend/, services/, db/, schemas/, seed.py}
│   ├── alembic/versions/ alembic.ini pyproject.toml Dockerfile
├── frontend/src/{pages,components,api,hooks,lib}/
├── test/{dev-env, impl/<Nth>, backend}/
├── data/                 # lotto.db, cache/ (git 제외)
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
| Docker 없음 경고 | local 전용(SQLite)이라 무시 가능 |
| `This project is configured to use 9.9.0 of pnpm` | `packageManager` 핀 ≠ 전역 pnpm. 반드시 `frontend/` 안에서 `pnpm …` 실행(Makefile·Procfile 은 `cd frontend &&` 사용). 또는 핀을 설치 버전으로 변경 |

## 다음 단계 / 잔여

- Q4(3~5등 고정 당첨금)·Q5(run 보존 개수) 최종 확인 — 둘 다 env 기본값으로 잠정 확정.
- Playwright 스모크(P2) — 브라우저 바이너리 다운로드 필요, 미착수(대체: browse 라이브 스크린샷).
- API 경로 변경 시 `test/backend/openapi_paths.snapshot.json` 의도적 갱신 필요.
- 선택: `/wise-dev-std:review`(코드 리뷰), `/wise-dev-std:standardize`(IDE 규칙).
