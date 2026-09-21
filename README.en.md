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

Run with Docker instead of honcho (current env, S7.1 — same `./data` DB):

```bash
make local-stop                  # if honcho holds 8000/5173 (or use other ports, below)
make docker-all                  # build + start api/web; api runs alembic upgrade head on start
LOTTO_DOCKER_SEED=1 make docker-all   # empty DB → also import the full xlsx
make docker-logs SVC=api         # [entrypoint] alembic upgrade head → uvicorn
make docker-ps / docker-stop     # status / tear down (host ./data kept)
LOTTO_BACKEND_PORT=18000 LOTTO_FRONTEND_PORT=15173 make docker-all   # side by side with honcho
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
| `make reanalyze [PRESET=quick|report|deep] [COHORTS=A,B,ALL]` | **Back up the DB file (`data/backup/lotto_<UTC>.db`) and re-run analysis for cohorts A, B, ALL** (`python -m app.reanalyze`, trigger=reanalyze). Old runs are kept and pruned by `LOTTO_RUN_RETENTION` |
| `make docker-all` / `docker-build` / `docker-logs` / `docker-stop` / `docker-restart` / `docker-ps` | **[docker, current env]** build & start backend (api) + frontend (web) containers in the background / build / logs (`SVC=api\|web`) / tear down / restart / status. Uses `.env.local` as env_file and for port mapping, shares `./data` (SQLite, cache, backups) and `./.docs` as volumes. **api runs `alembic upgrade head` on start** before uvicorn; `LOTTO_DOCKER_SEED=1 make docker-all` also imports the full xlsx. web is the Vite dev server proxying `/api` to `api:8000`. If honcho already holds the ports the target stops with a hint (`make local-stop`, or `LOTTO_BACKEND_PORT=18000 LOTTO_FRONTEND_PORT=15173 make docker-all`) |
| `make docker-migrate` / `docker-seed` / `docker-reanalyze` | [docker] migration only / full xlsx import (idempotent) / backup + re-analysis (`PRESET`, `COHORTS`) |
| `make <env>-*` | dev/staging/prod container targets — kept for standard compatibility, unused |

## Environment (`.env.local`)

Variable names are literal English translations of the Korean terms with a `LOTTO_` prefix. Full list: `.env.local.example`, PRD §10.
Precedence (low → high): `.env.local.example` (defaults) → `.env` → `.env.local` (your values) → OS environment. After changing a value run `make local-restart` (uvicorn reload does not watch env files).

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
| `LOTTO_CROSS_DRAW_LAG` | 5 | **Cross-draw gap L** (1–50) for the previous→next draw co-occurrence analysis: lags 1..L individually plus the summed window; edge draws (first/last L) contribute only the pairs that exist inside the gap. After changing: `make local-restart`, then a new run (or `make reanalyze`). Current value visible in `GET /config` / Settings; the cross-draw page warns when the run's L differs |
| `LOTTO_RECENT_DRAWS` | 5 | Number of **recent winning-number draws** shown next to the My Numbers 'saved numbers' title (1–20, S5.8). Exposed as `/config` `lotto_recent_draws`. Local: **applied on save** (uvicorn watches `.env.local`); docker: `make docker-restart` |
| `LOTTO_LOTTERY_PICK_COUNT` | 5 | Default number of ★ tickets picked by My Numbers 'Try a draw with saved numbers' (1–50, S5.5). Exposed as `/config` `lotto_lottery_pick_count`; editable per session via the 'pick count' box |
| `LOTTO_PRIZE_RANK3_DEFAULT` / `_RANK4_` / `_RANK5_` | 1500000 / 50000 / 5000 | Fixed prizes for ranks 4–5; rank 3 default only when the draw has no actual value (total ÷ winning games); exposed via `/config` to the result-entry form |
| `DATABASE_URL` | `sqlite:///./data/lotto.db` | Relative to project root; resolved to absolute |
| `LOTTO_TIMEZONE` / `VITE_TIMEZONE` | Asia/Seoul | Display timezone (IANA). Stored as UTC; API returns ISO with `+00:00`; the UI converts and shows "KST (UTC+9)" |

## API (v1, `http://127.0.0.1:8000/docs`)

| Area | Endpoints |
|---|---|
| Config | `GET /api/v1/config` |
| Data | `POST /data/import` (xlsx/csv incremental, `?overwrite`) · `POST /data/draws` (optional per-rank `prizeN` = prize per game and `winnersN` = winning games for ranks 1–5; S1.6) · `GET /data/draws[/{n}]` · `GET /data/summary` · `GET /data/imports` |
| Analysis | `POST /analysis/runs` · `GET /analysis/runs[/latest|/{id}]` · `GET /analysis/runs/{id}/{section}` (summary, frequency, frequency_bonus, global, pairs, network, itemsets, groups, temporal, **cross_draw**, winners_model, null_summary, diff_vs_previous) · `DELETE /analysis/runs/{id}` · `POST /analysis/itemsets/query` |
| Validation | `POST /validation/runs` · `GET /validation/runs[/latest|/{id}]` · `GET /validation/runs/{id}/{kind}` (meta, backtest, scoring, replication, homogeneity) |
| Recommend | `GET /recommend/strategies` · `POST /recommend` (→ sets[].params_used/experiment, analysis_basis, tickets[].`past_wins` = past 1st/2nd-prize draws matching the ticket, S4.9) · `GET /recommend/history?origin=user|backtest|all&…` (each row carries `past_wins`) · `GET /recommend/history/summary?origin=` · `POST /recommend/sequential` {strategies?, count?, seed?, max_shared?, save} → **run every strategy in catalog order** (one batch per strategy, no extra uniform control, failing strategies reported in `failed` and skipped; S4.11) · `DELETE /recommend/history[?target_draw_no=]` → **reset recommendations** (deletes user-origin recommendations of the upcoming draw = latest+1; 400 for draws whose result is entered; S4.12) · `POST /recommend/auto-register` {target_draw_no?, seed?} → draw 5 of 1..P at random, repeated target-draw-number times → top-5 positions by frequency → register each strategy's latest-batch tickets at those positions as my numbers (same numbers + target draw are ★ merged → `merged_duplicates`/`total_merged`, S4.10·S5.6) |
| Experiments (improvement loop) | `GET /experiments/strategy-params` · `POST /experiments/runs` · `GET /experiments/runs[?strategy]` · `GET /experiments/runs/{id}` · `GET /experiments/lineage?strategy=` · `GET /experiments/active` · `POST /experiments/runs/{id}/activate` · `POST /experiments/deactivate` · `DELETE /experiments/runs/{id}` |
| User | `POST /user/tickets/evaluate` · `POST /user/tickets` (same numbers + same target draw → merged into the existing row: `dup_count`+1, `dup_labels` appended, S5.6) · `GET /user/tickets?target_draw_no=` (draw filter, S5.7; each row: `dup_count` · `dup_labels` · `same_number_ticket_ids` · `duplicate`) · `DELETE /user/tickets?target_draw_no=` (required) → **reset my numbers** (deletes tickets of an upcoming target draw only; 400 once its result is entered; S5.9) · `GET /user/tickets/draws` (**active target draw** context: next_draw · latest_result_draw · active_target_draw · reason · draws[{target_draw_no,count,evaluated}] — next draw once a next-draw recommendation is saved / ticket registered, otherwise the most recent registered draw) · `DELETE /user/tickets/{id}` |
| Tracking | `GET /tracking/summary?origin=user|backtest` · `GET /tracking/consistency?origin=&source=&strategy=` → **recommendation consistency analysis** (per strategy: rank distribution, match-count GOF, number correlation, pair correlation, BH-adjusted q, `feedback`, `next_experiment`; S8.7) · `GET /tracking/outcomes?draw_no&strategy&source&origin&limit(≤50000)&offset` (each row carries `past_wins`) · `GET /tracking/outcomes/summary` · `GET /tracking/pending` · `POST /tracking/evaluate/{draw_no}` |

## Statistical engine (PRD §4)

Joe-adjusted χ² (J = (N−1)/(N−k)·X²), Coronel-Brizio order-statistic Q test, 990-pair calibrated lift with BH/BY and Westfall–Young maxT, Genest pair X², candidate triples and conditional P(1|2,3), multivariate-hypergeometric group patterns, MC null distributions for sum/consecutive/last-digit features, temporal tests (overlap, lag autocorrelation + maxT, runs, gap KS, Ljung–Box, CUSUM/PELT), **cross-draw co-occurrence** (S2.13: directed 45×45 matrix of number i in draw t → number j in draw t+ℓ, diagonal = repeats, lags 1..L individually plus the summed window, null cell probability (k/N)², margin-conditioned 2×2 independence z so frequent numbers are not inflated, BH/BY and MC maxT per lag / window / any-lag, edge draws partially included), negative-binomial winners model, and 8 recommendation strategies (weighted sampling without replacement via A-Res, pair-sequential, typicality filter, low-competition).

## Validation results (2026-09-08, PRD §17)

- Cohorts A, B and ALL are all consistent with the uniform null (J p = 0.888 / 0.393 / 0.877; maxT, Genest, CUSUM non-significant).
- **Re-analysis (2026-09-14, including draw 1,241, PRD §17.5)**: cohorts A (1–1,000), B (1,001–1,241), ALL (1–1,241) J p = 0.888 / 0.396 / 0.874; **cross-draw co-occurrence (window 1..5)** max-cell maxT p = 0.087 / 0.396 / 0.125, zero FWER-significant cells, repeat z = 0.70 / −1.77 / 0.27 — no evidence of dependence between numbers of previous and following draws.
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
| impl/14th | S4.9 past 1st/2nd-prize draw tag `(386)` next to recommended tickets (recommend cards · history · tracking outcomes, small gray text) | PASS 5/5 (pytest 61, vitest 30) |
| impl/15th | S4.10 'Auto-register as my numbers' in recommendation history (random top-5 positions → latest-batch tickets per strategy, `POST /recommend/auto-register`) | PASS 5/5 (pytest 62, vitest 31) |
| impl/16th | S4.7/S4.10 UX — auto-register rule shown only as button tooltip; history-row 'register as my number' registers immediately without a confirm dialog | PASS 4/4 (pytest 62, vitest 31) |
| impl/17th | S5.5 My Numbers 'Try a draw with saved numbers' — random-frequency rule over 1..N saved tickets (`lib/lottery.ts`) stars 5 tickets, UI state only (no DB write) | PASS 6/6 (pytest 62, vitest 34) |
| impl/18th | S5.6 My Numbers **★ duplicate ×n badge** — same numbers + same target draw merge into one row (`user_ticket.dup_count/dup_labels`, Alembic 5b12a3e1), same numbers on another draw are linked via `same_number_ticket_ids`, auto-register skip→merge, glossary term `duplicate_ticket` (repeated generation ≠ evidence of significance) | PASS 8/8 (pytest 63, vitest 35) |
| impl/19th | Bug fix — white screen when evaluating My Numbers with a bonus (scorecard `bonus` dict → int, `bonus_info` split out, defensive ScorecardView render) | PASS 4/4 (pytest 63, vitest 37) |
| impl/20th | Bug fix — `.env.local` values ignored (pydantic-settings gives the later `env_file` precedence, so the example file overrode user values; reordered to example → `.env` → `.env.local`, precedence regression test) | PASS 6/6 (pytest 65, vitest 37) |
| impl/39th | v1.21 **`.env`-managed pick count** — `LOTTO_LOTTERY_PICK_COUNT` (default 5) + input box before the draw-attempt button; the attempt result text now sits to the right of the border legend on the same line | PASS 5/5 (pytest 91, vitest 70) |
| impl/38th | S5.10 **draw-attempt display** — ★ tickets sorted to the top; numbers of ★ tickets that appeared in the last 6 draws' winning numbers get a ring by count (white inner ring + 1× black / 2× yellow / 3× blue / 4× red / 5× gray / 6× green) with legend | PASS 6/6 (vitest 66) |
| impl/37th | v1.19 **guards** — reset recommendations, reset my numbers and recommendation auto-register work only on the upcoming draw whose result is not entered yet (API 400, button disabled with reason tooltip); the duplicated 'Enter draw result / upload' section on the Tracking page is commented out | PASS 8/8 |
| impl/36th | S1.7 **past 6 draws beside result entry** — draw-number chips (1242…1237) right of the 'Enter draw result' title, hover/focus tooltip table (winning numbers, total prize per rank, winning games, prize per game), reuses `GET /data/draws` | PASS 5/5 (vitest 59) |
| impl/35th | S1.6 v1.17 **per-rank total prize entry & auto-calc** — ranks 1–3: total ÷ winning games → prize per game; ranks 4/5 keep fixed values (50,000 / 5,000); full-width 5-column rank table, emphasized data summary, separate entry/upload panels, upload hint beside the button | PASS 7/7 (vitest 56) |
| impl/34th | S8.7–S8.9 **recommendation consistency analysis** — all recommended tickets vs actual results (rank distribution, match-count GOF, number & pair correlation, BH correction, retune suggestion), section on the Tracking page, `GET /tracking/consistency` | PASS 8/8 (pytest 88, vitest 54) |
| impl/33rd | S1.6 **Settings/Run result-entry rework** — direct entry above file upload, upload controls on one line, winning games & prize per game for ranks 1–5 (`draws.prize3..5/winners3..5`, Alembic c41d7a92) | PASS 6/6 (pytest 88, vitest 54) |
| impl/32nd | User request — **Reset recommendations** (current-draw recs, S4.12) and **Reset my numbers** (displayed target draw, S5.9) buttons, buttons laid out on one line | PASS 7/7 (pytest 79, vitest 49) |
| impl/31st | User report "changed `LOTTO_RECENT_DRAWS` but nothing happened" — uvicorn `--reload` watched only `backend/*.py`. Procfile now `--reload-dir .. --reload-include .env.local` (frontend/data/test excluded) → **backend restarts on `.env` save** (applied within 1 s). Fixed `make local-restart` port race (`Address already in use`) | PASS 4/4 |
| impl/30th | S5.8 recent draws in a **2-column grid** (`grid-cols-[repeat(2,max-content)]`, no label wrap, right tools `shrink-0`) — 3 columns overlapped the right tools at 1280px, user chose 2 | PASS 3/3 (pytest 76, vitest 46) |
| impl/29th | S5.8 recent-draw count now **`.env`-managed** — `LOTTO_RECENT_DRAWS` (default 5, 1–20) → `/config` `lotto_recent_draws` → My Numbers (single request after config loads), Settings help text, contract test | PASS 5/5 (pytest 76, vitest 46) |
| impl/28th | S5.8 **saved-numbers header layout & recent winning numbers** — target-draw filter and 'Try a draw with saved numbers' stacked vertically on the right; latest 5 draws' winning numbers next to the title (`GET /data/draws?limit=5&order=desc`, display only; Section `aside` slot) | PASS 6/6 (pytest 76, vitest 46) |
| impl/27th | S7.1 **docker compose runtime** — Dockerfiles fixed (lockfiles, `.dockerignore`, `/srv/lotto` root), api entrypoint `alembic upgrade head` (+ optional seed) → uvicorn, web Vite proxy → `api:8000`, 9 `make docker-*` targets. Verified live on 18000/15173: migration log, health, API (1,241 draws), frontend proxy, fresh-DB migration (3 revisions), honcho port-conflict guard | PASS 8/8 (pytest 76, vitest 45) |
| impl/26th | UI fix — "추천 생성" / "추천 생성(순차)" rendered on two lines → button slot spans 2 columns, no wrap | PASS 3/3 (vitest 45) |
| impl/25th | S4.11 **Sequential recommend** — button right of "추천 생성" runs every strategy in order with the same options (one batch per strategy, `POST /recommend/sequential`), per-strategy result sections + summary | PASS 5/5 (pytest 76, vitest 45) |
| impl/24th | User report "cross-draw `.env` setting not applied" — engine did apply it; `/config` and Settings did not expose it. Exposed `lotto_cross_draw_lag`·`lotto_min_effect_delta`·`lotto_run_retention`, cross-draw page shows env-vs-run L mismatch notice | PASS 5/5 (pytest 74, vitest 44) |
| impl/23rd | S5.7 **saved-numbers draw switch & filter** — right after a draw result is entered the old tickets and their outcomes stay visible; **once a recommendation for the next draw is saved** the list switches to the next draw (previous draw hidden, not deleted), draw filter (auto/specific/all), `GET /user/tickets/draws` | PASS 6/6 (pytest 74, vitest 42) |
| impl/22nd | Bug fix — glossary tooltip text overflowed its box (inherited `whitespace-nowrap` from table headers → tooltip forces `whitespace-normal break-words` + viewport width cap) | PASS 3/3 (vitest 40) |
| impl/21st | S2.13 **cross-draw co-occurrence** (prev i → next j 45×45, lags 1..L + window, conditional independence z · MC maxT, edge draws partially included) · `LOTTO_CROSS_DRAW_LAG` · page `/cross-draw` · `make reanalyze` (backup, then re-run cohorts A/B/ALL including draw 1,241) | PASS 11/11 (pytest 72, vitest 39) |

## Layout

```
Lotto-Rec/
├── .docs/                # PRD.md (source of truth), research notes, lotto(~1240).xlsx
├── backend/{app/{main.py, api/, core/, core/recommend/, services/, db/, schemas/, seed.py, reanalyze.py}, alembic/, Dockerfile, docker-entrypoint.sh}
├── frontend/src/{pages,components,api,hooks,lib}/
├── test/{dev-env, impl/<Nth>, backend}/
├── data/                 # lotto.db, cache/, backup/ (git-ignored; backup/ is written by make reanalyze)
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
| Changed `LOTTO_CROSS_DRAW_LAG` but the cross-draw page looks the same / not shown in Settings | The gap is frozen at run creation (section field `max_lag`). Order: edit `.env.local` → `make local-restart` (local now restarts on `.env.local` save automatically, v1.14.3; docker: `make docker-restart`) → check `lotto_cross_draw_lag` in Settings → new run or `make reanalyze`. The cross-draw page shows a blue notice when the run's L differs from the current setting (v1.11.1) |
| Only one number's diagonal (repeat) cell looks large on the cross-draw page | That number is simply frequent overall. The displayed/tested z is the margin-**conditioned** independence z, which is not inflated (the unconditional expectation is shown as reference column `expected`) |
| "My numbers" list looks empty after entering a draw result | By design (S5.7): the list switches to the next draw the moment a next-draw recommendation is saved (or a next-draw ticket registered). Older tickets are not deleted — pick that draw or "all draws" in the target-draw filter |
| (?) tooltip text in a table header runs off the box on one line | `DataTable` th/td `whitespace-nowrap` is inherited by the tooltip. v1.10.1 forces `whitespace-normal break-words` and `max-w-[calc(100vw-2rem)]` on the `Term` tooltip — it wraps and grows vertically |
| `make docker-all` stops with "honcho 가 실행 중" | Port-conflict guard (8000/5173). Run `make local-stop` first, or `LOTTO_BACKEND_PORT=18000 LOTTO_FRONTEND_PORT=15173 make docker-all` |
| api container ignores `.env.local` / path errors | compose injects `.env.local` as env_file (quoted values handled). Container root is `/srv/lotto` (`./data/lotto.db` → `/srv/lotto/data/lotto.db`). After edits: `make docker-restart SVC=api` |
| web container cannot reach the API | web is the Vite dev server proxying `/api` to `VITE_API_BASE=http://api:8000`; it starts only after api is healthy. Check `make docker-logs SVC=api` |
| `This project is configured to use 9.9.0 of pnpm` | `packageManager` pin ≠ global pnpm. Always run `pnpm` inside `frontend/` (Makefile/Procfile use `cd frontend &&`) |
| **White screen after evaluating with a bonus** | scorecard `bonus` came back as an object and `BallRow` rendered it → React crash. v1.9.1 pins `bonus` to int\|null, moves details to `bonus_info`, frontend renders defensively |
| **`.env.local` values (e.g. `LOTTO_NUMBER_RECOMMENDATION_COUNT=20`) not applied** | pydantic-settings gives precedence to the **later** file in the `env_file` tuple, and `.env.local.example` came last, so defaults always won. v1.9.2 reorders to example → `.env` → `.env.local`. Env-file edits are not picked up by uvicorn reload — run `make local-restart` |
| Prizes of draws 1241/1242 looked far too large | Earlier manual entries put the per-rank **total** prize into the '1st prize' field (xlsx seed rows hold prize per game). Corrected on 2026-09-21 as total ÷ winners (backup `data/backup/lotto_pre_prizefix_*.db`). The form now labels the field 'prize per game' (v1.16) |

