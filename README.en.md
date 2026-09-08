# Lotto number recommender (Lotto-Rec)

A personal, local-only web platform for **statistical analysis of Korean Lotto 6/45 draws (1–1,240)** under the uniform
k-of-N without-replacement null, **out-of-sample validation** (cohort A: draws 1–1,000 → cohort B: 1,001+), and
statistics-based **ticket evaluation, automated recommendations, and outcome tracking**.

> **Scaffold info**: `wise-dev-std` / profile `custom` (`python-fastapi` base + React SPA). Decisions: [CUSTOM_STACK.md](CUSTOM_STACK.md). Requirements (Korean): [.docs/PRD.md](.docs/PRD.md). Compliance: [COMPLIANCE.md](COMPLIANCE.md).

[한국어](README.md)

## Principles (PRD §4.11)

- Even in a fair draw, pair correlations are structurally negative (−1/44); the naive lift under H0 is 0.852 (≠1) → the platform uses a **design-calibrated lift**.
- Raw p<0.05 is only an exploratory candidate; scanning 990 pairs yields ~50 such candidates by chance.
- Significance ≠ predictability. **Recommended tickets have the same winning probability as uniform random picks**; any difference is measured by validation and outcome tracking.

## Tech Stack

| Layer | Tools |
|---|---|
| Backend | Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2 + Alembic, NumPy/SciPy/pandas/statsmodels/ruptures, uv |
| Frontend | React 18 + TypeScript + Vite, Tailwind CSS, Plotly (react-plotly.js), TanStack Query, react-router, pnpm |
| Storage | SQLite (`data/lotto.db`) + cache (`data/cache/*.npy`) |
| Run | Makefile + honcho (`Procfile.dev`) / pm2 alternative, **local only** |
| Tests | pytest (+httpx, hypothesis) / vitest, all under `test/` |
| CI | GitHub Actions (ruff · mypy · pytest / eslint · tsc · vitest · build) |

## Prerequisites

Python 3.12+, [uv](https://docs.astral.sh/uv/), Node 22+, pnpm 9, GNU Make. Docker optional (unused locally).

## Quick Start

```bash
make preflight
make local-build     # uv sync + pnpm install, creates .env.local from the example
make db-migrate      # creates data/lotto.db
make db-seed         # loads draws 1–1,000 (cohort A) from .docs/lotto(~1240).xlsx
make local-all       # backend http://127.0.0.1:8000/docs · frontend http://127.0.0.1:5173
make local-logs
make test
make local-stop
```

First-use flow: Settings → **run analysis (cohort A, quick)** → Validation → **run validation (replay 1,001–1,240)** → Recommend / My numbers / Tracking.
Validation inserts the real cohort-B draws into the DB (labelled B), so the DB then holds 1,240 draws.

## Make Targets

| Target | Description |
|---|---|
| `make preflight` | Check runtimes/tools (Docker → WARN only) |
| `make local-build` | Install dependencies |
| `make local-all` / `local-logs` / `local-stop` / `local-restart` / `local-ps` | Start/tail/stop/restart/status of backend+frontend (honcho in background; `PROC_MGR=pm2`; `LOCAL_INFRA=` for optional docker infra) |
| `make test` / `make lint` | pytest + vitest / ruff + mypy + eslint + tsc |
| `make db-migrate` / `db-seed` / `db-reset` / `db-fresh` | Alembic / incremental xlsx import of cohort A (`python -m app.seed [--all|--max-draw N]`) / recreate SQLite / reset+seed |
| `make <env>-*` | dev/staging/prod container targets — kept for standard compatibility, unused |

## Environment (`.env.local`)

Variable names are literal English translations of the Korean terms with a `LOTTO_` prefix. Full list: `.env.local.example`, PRD §10.

| Variable | Default | Meaning |
|---|---|---|
| `LOTTO_NUMBER_RECOMMENDATION_COUNT` | 10 | Number of recommended tickets (1–50) |
| `LOTTO_TRAIN_END_DRAW` | 1000 | Last draw of cohort A; later draws are cohort B |
| `LOTTO_SOURCE_FILE` | `".docs/lotto(~1240).xlsx"` | Source file (quote it — parentheses) |
| `LOTTO_MC_ITERATIONS` / `_REPORT` / `_DEEP` | 10000 / 100000 / 500000 | Monte-Carlo presets |
| `LOTTO_SIGNIFICANCE_LEVEL` / `LOTTO_DEFAULT_CORRECTION` | 0.05 / fdr_bh | α / default correction |
| `LOTTO_RANDOM_SEED` | 20260908 | Reproducibility seed |
| `LOTTO_AUTO_RERUN_PRESET` | quick | Auto re-analysis after new draws (`off` to disable) |
| `LOTTO_RUN_RETENTION` | 20 | Analysis runs to keep (0 = unlimited); latest per cohort and runs referenced by active experiments are protected |
| `LOTTO_PRIZE_RANK3_DEFAULT` / `_RANK4_` / `_RANK5_` | 1500000 / 50000 / 5000 | Fixed prizes for ranks 3–5 (assumed, tracking only) |
| `DATABASE_URL` | `sqlite:///./data/lotto.db` | Relative to project root; resolved to absolute |
| `LOTTO_TIMEZONE` / `VITE_TIMEZONE` | Asia/Seoul | Display timezone (IANA). Stored as UTC; API returns ISO with `+00:00`; the UI converts and shows "KST (UTC+9)" |

## API (v1, `http://127.0.0.1:8000/docs`)

| Area | Endpoints |
|---|---|
| Config | `GET /api/v1/config` |
| Data | `POST /data/import` (xlsx/csv incremental, `?overwrite`) · `POST /data/draws` · `GET /data/draws[/{n}]` · `GET /data/summary` · `GET /data/imports` |
| Analysis | `POST /analysis/runs` · `GET /analysis/runs[/latest|/{id}]` · `GET /analysis/runs/{id}/{section}` (summary, frequency, frequency_bonus, global, pairs, network, itemsets, groups, temporal, winners_model, null_summary, **diff_vs_previous**) · `DELETE /analysis/runs/{id}` · `POST /analysis/itemsets/query` |
| Validation | `POST /validation/runs` · `GET /validation/runs[/latest|/{id}]` · `GET /validation/runs/{id}/{kind}` (meta, backtest, scoring, replication, homogeneity) |
| Recommend | `GET /recommend/strategies` · `POST /recommend` (→ sets[].params_used/experiment, analysis_basis) · `GET /recommend/history?origin=user|backtest|all&…` · `GET /recommend/history/summary?origin=` |
| Experiments (improvement loop) | `GET /experiments/strategy-params` · `POST /experiments/runs` · `GET /experiments/runs[?strategy]` · `GET /experiments/runs/{id}` · `GET /experiments/lineage?strategy=` · `GET /experiments/active` · `POST /experiments/runs/{id}/activate` · `POST /experiments/deactivate` · `DELETE /experiments/runs/{id}` |
| User | `POST /user/tickets/evaluate` · `POST /user/tickets` · `GET /user/tickets` · `DELETE /user/tickets/{id}` |
| Tracking | `GET /tracking/summary?origin=user|backtest` · `GET /tracking/outcomes?draw_no&strategy&source&origin&limit(≤50000)&offset` · `GET /tracking/outcomes/summary` · `GET /tracking/pending` · `POST /tracking/evaluate/{draw_no}` |

## Statistical engine (PRD §4)

Joe-adjusted χ² (J = (N−1)/(N−k)·X²), Coronel-Brizio order-statistic Q test, 990-pair calibrated lift with BH/BY and Westfall–Young maxT, Genest pair X², candidate triples and conditional P(1|2,3), multivariate-hypergeometric group patterns, MC null distributions for sum/consecutive/last-digit features, temporal tests (overlap, lag autocorrelation + maxT, runs, gap KS, Ljung–Box, CUSUM/PELT), negative-binomial winners model, and 8 recommendation strategies (weighted sampling without replacement via A-Res, pair-sequential, typicality filter, low-competition).

## Validation results (2026-09-08, PRD §17)

- Cohorts A, B and ALL are all consistent with the uniform null (J p = 0.888 / 0.393 / 0.877; maxT, Genest, CUSUM non-significant).
- Replay backtest 1,001–1,240 × 8 strategies × 10 tickets: **every strategy "no difference from uniform"**, zero rank-1–3 hits, replication 0/29 (H0 expectation 2.5%).
- Improvement loop (`analysis_weighted`, K=8, tune 1,001–1,120 → holdout 1,121–1,240): best tune diff +0.007 (H0 best-of-8 expectation +0.046) → holdout −0.021; generation 2: +0.025 → −0.058. **Gains vanish on holdout (regression to the mean)** — PRD §17.4.

## Tests

| Iteration | Scope | Result |
|---|---|---|
| dev-env | standard environment | PASS (1 fix: quote `.env.local` path with parentheses) |
| impl/1st | E1 data / incremental import | PASS 8/8 |
| impl/2nd | E2 statistical engine | PASS 12/12 |
| impl/3rd | E3/E4/E5/E8 validation / recommend / tracking | PASS 13/13 (round 2) |
| impl/4th | E6 dashboard (10 pages) | PASS 12/12 (round 3, 6 live screenshots, 0 console errors) |
| impl/5th | S4.6 recommendation history filters / view-all + S4.7 register recommended ticket as my number | PASS 10/10 (pytest 42, vitest 16) |
| impl/6th | E9 strategy-improvement loop (simulation experiments) + S4.8 analysis basis in recommendations | PASS 12/12 (pytest 50, vitest 18) |
| impl/7th | recommendation-history origin filter (user / validation replay / all) | PASS 6/6 (pytest 51, vitest 18) |
| impl/8th | run-to-run diff summary · run retention · injected-bias power test | PASS 5/5 (pytest 54, vitest 18) |
| impl/9th | shared UX: form alignment (3-line Field) · two-line brand · floating theme menu | PASS 6/6 (vitest 21) |
| impl/10th | S8.6 tracking outcome filters (draw · strategy · source · page size) | PASS 5/5 (pytest 55, vitest 22) |
| impl/11th | term tooltips (`Term`, 65 terms · 165 usages) · glossary page `/glossary` | PASS 5/5 (vitest 28) |
| impl/12th | display timezone KST (`LOTTO_TIMEZONE`, `to_iso`) | PASS 6/6 (pytest 56) |
| impl/13th | OpenAPI contract test (42-path snapshot · response shapes) · PRD acceptance/roadmap status | PASS 4/4 (pytest 59) |

## Layout

```
Lotto-Rec/
├── .docs/                # PRD.md (source of truth), research notes, lotto(~1240).xlsx
├── backend/app/{main.py, api/, core/, core/recommend/, services/, db/, schemas/, seed.py}
├── frontend/src/{pages,components,api,hooks,lib}/
├── test/{dev-env, impl/<Nth>, backend}/
├── data/                 # lotto.db, cache/ (git-ignored)
├── Makefile Procfile.dev ecosystem.config.cjs docker-compose.yml
└── .env.local(.example)  CUSTOM_STACK.md  COMPLIANCE.md
```

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `./.env.local: syntax error near unexpected token '('` | Quote the `LOTTO_SOURCE_FILE` value |
| `make db-seed` inserts 0 rows | Already loaded (idempotent). Load cohort B too with `python -m app.seed --all` |
| Run stays `running` for long | deep preset (500k) takes 15+ min; poll `GET /analysis/runs/{id}` |
| Recommendation says `fallback: winners_model 없음` | No completed cohort-A run yet — run an analysis first |
| Tailwind config change (e.g. darkMode) not reflected | Vite dev server loads tailwind.config at start → `make local-restart` |
| History shows few rows even with "all" page size | Default origin = user-generated (saved) tickets only. Switch the origin filter to "validation replay" or "all" to see simulation tickets |
| `This project is configured to use 9.9.0 of pnpm` | `packageManager` pin ≠ global pnpm. Always run `pnpm` inside `frontend/` (Makefile/Procfile use `cd frontend &&`) |
