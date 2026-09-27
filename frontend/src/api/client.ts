// API 클라이언트 — dev 는 Vite proxy(/api → backend), build 는 VITE_API_BASE 사용.
const BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE ?? '');

export class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

/** 경로 + 쿼리 조립 (null/undefined 생략). */
export function buildUrl(path: string, params?: QueryParams): string {
  const qs = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === null || v === undefined || v === '') continue;
      qs.set(k, String(v));
    }
  }
  const q = qs.toString();
  return `${BASE}${path}${q ? `?${q}` : ''}`;
}

async function request<T>(path: string, init?: RequestInit, params?: QueryParams): Promise<T> {
  const res = await fetch(buildUrl(path, params), init);
  if (!res.ok) {
    let detail: unknown = undefined;
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      detail = body;
      if (typeof body?.detail === 'string') message = body.detail;
      else if (Array.isArray(body?.detail))
        message = body.detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join('; ');
    } catch {
      /* 본문 없음 */
    }
    throw new ApiError(res.status, message, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const get = <T>(path: string, params?: QueryParams) => request<T>(path, undefined, params);
const del = <T>(path: string) => request<T>(path, { method: 'DELETE' });
const post = <T>(path: string, body?: unknown, params?: QueryParams) =>
  request<T>(
    path,
    {
      method: 'POST',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    params,
  );

// ---------- 공통 ----------
export interface Health {
  status: string;
  env: string;
}

export interface AppConfig {
  app_name: string;
  lotto_number_recommendation_count: number;
  lotto_pool_size: number;
  lotto_main_count: number;
  lotto_train_end_draw: number;
  lotto_significance_level: number;
  lotto_default_correction: string;
  mc_iterations: { quick: number; report: number; deep: number };
  lotto_random_seed: number;
  lotto_auto_rerun_preset: string;
  lotto_cross_draw_lag?: number;
  lotto_min_effect_delta?: number;
  lotto_run_retention?: number;
  lotto_recent_draws?: number;
  lotto_lottery_pick_count?: number;
  lotto_seed_search_max_iter?: number;
  lotto_prize_rank3_default?: number;
  lotto_prize_rank4_default?: number;
  lotto_prize_rank5_default?: number;
  timezone?: string;
}

export type Cohort = 'A' | 'B' | 'ALL';
export type Preset = 'quick' | 'report' | 'deep';
export type Correction = 'bonferroni' | 'holm' | 'fdr_bh' | 'fdr_by';
export type JobStatus = 'pending' | 'running' | 'done' | 'error';

// ---------- 데이터 ----------
export interface DataSummary {
  total_draws: number;
  min_draw: number | null;
  max_draw: number | null;
  train_end_draw: number;
  cohort_a_count: number;
  cohort_b_count: number;
  missing_draws: number[];
  integrity: { invalid_rows: unknown[]; contiguous: boolean; all_sorted: boolean };
  latest_import: ImportSummary | null;
}

export interface ImportSummary {
  import_id: number;
  filename: string;
  inserted: number;
  skipped_duplicate: number;
  conflicts: number | unknown[];
  created_at: string;
}

export interface ImportReport {
  import_id: number;
  filename: string;
  data_hash: string;
  inserted: number;
  skipped_duplicate: number;
  inserted_draws: number[];
  conflicts: unknown[];
  invalid: unknown[];
  triggered_run_id: string | null;
  created_at?: string;
}

export interface Draw {
  draw_no: number;
  numbers: number[];
  bonus: number;
  prize1: number | null;
  winners1: number | null;
  prize2: number | null;
  winners2: number | null;
  prize3: number | null;
  winners3: number | null;
  prize4: number | null;
  winners4: number | null;
  prize5: number | null;
  winners5: number | null;
  cohort: 'A' | 'B';
}

export interface DrawIn {
  draw_no: number;
  numbers: number[];
  bonus: number;
  prize1?: number | null;
  winners1?: number | null;
  prize2?: number | null;
  winners2?: number | null;
  prize3?: number | null;
  winners3?: number | null;
  prize4?: number | null;
  winners4?: number | null;
  prize5?: number | null;
  winners5?: number | null;
  overwrite?: boolean;
}

// ---------- 분석 run ----------
export interface RunMeta {
  run_id: string;
  cohort: Cohort;
  draw_from: number;
  draw_to: number;
  n_draws: number;
  preset: Preset;
  alpha: number;
  correction: Correction;
  mc_iterations: number;
  seed: number;
  data_hash: string;
  versions: Record<string, string>;
  status: JobStatus;
  progress: number;
  stage: string | null;
  error: string | null;
  trigger: string;
  created_at: string;
  finished_at: string | null;
  diff_summary?: string | null;
}

export interface RunCreate {
  cohort: Cohort;
  preset: Preset;
  alpha?: number | null;
  correction?: Correction | null;
  seed?: number | null;
  mc_iterations?: number | null;
}

export type Section =
  | 'summary'
  | 'frequency'
  | 'frequency_bonus'
  | 'global'
  | 'pairs'
  | 'network'
  | 'itemsets'
  | 'groups'
  | 'temporal'
  | 'cross_draw'
  | 'winners_model'
  | 'null_summary'
  | 'diff_vs_previous';

export interface SummarySection {
  run_id: string;
  cohort: Cohort;
  draw_from: number;
  draw_to: number;
  T: number;
  N: number;
  k: number;
  slots: number;
  alpha: number;
  correction: Correction;
  mc_iterations: number;
  seed: number;
  kpi: {
    global_p_joe: number;
    global_p_mc: number;
    order_stat_p: number;
    n_sig_numbers_bh: number;
    n_sig_numbers_holm: number;
    n_sig_pairs_bh: number;
    n_sig_pairs_fwer: number;
    max_pair: [number, number];
    max_pair_z: number;
    max_pair_p_maxT: number;
    genest_p_mc: number;
    temporal_alerts: string[];
    overlap_mean: number;
    cusum_p_mc: number;
    cross_draw_lag?: number;
    cross_draw_max_cell?: [number, number];
    cross_draw_max_z?: number;
    cross_draw_p_maxT?: number | null;
    cross_draw_any_lag_p_maxT?: number | null;
    cross_draw_n_sig_bh?: number;
    cross_draw_alerts?: string[];
    [k: string]: unknown;
  };
  verdict: { consistent_with_uniform_null: boolean; flags: string[] };
  interpretation_policy: string[];
}

export interface FrequencyRow {
  number: number;
  role: 'main' | 'bonus';
  observed: number;
  expected: number;
  residual: number;
  z: number;
  p: number;
  p_bonferroni: number;
  p_holm: number;
  q_bh: number;
  q_by: number;
  sig_bh: boolean;
  sig_holm: boolean;
}

export interface FrequencySection {
  role: 'main' | 'bonus';
  T: number;
  expected: number;
  sd: number;
  pi95: [number, number];
  pi99: [number, number];
  rows: FrequencyRow[];
  n_sig_bh: number;
  n_sig_holm: number;
  max_abs_z: number;
  argmax_number: number;
}

export interface GlobalSection {
  pearson_x2: { statistic: number; df: number; p_naive: number; p_mc: number; note?: string };
  joe_J: { statistic: number; df: number; p_asymptotic: number; factor: number; p_mc: number };
  g_test: { statistic: number; df: number; p_asymptotic_adjusted: number };
  mc_iterations: number;
  order_stat_Q: {
    statistic: number;
    df: number;
    p_asymptotic: number;
    p_mc: number;
    mean_observed: number[];
    mean_null: number[];
    sd_null_single: number[];
    T: number;
  };
  max_abs_z_single: { observed: number; number: number; p_maxT: number };
}

export interface PairRow {
  a: number;
  b: number;
  observed: number;
  expected: number;
  calibrated_lift: number;
  residual: number;
  z: number;
  cond_prob_b_given_a: number;
  cond_prob_null: number;
  p: number;
  p_bonferroni: number;
  p_holm: number;
  q_bh: number;
  q_by: number;
  sig_bh: boolean;
  p_maxT: number;
  sig_fwer: boolean;
}

export interface PairsSection {
  summary: {
    T: number;
    n_pairs: number;
    expected: number;
    p_pair: number;
    naive_lift_null: number;
    corr_null: number;
    n_sig_bh: number;
    n_sig_by: number;
    n_raw_p05: number;
    expected_false_positives_raw: number;
    max_abs_z: number;
    max_pair: [number, number];
    max_pair_p_maxT: number;
    n_sig_fwer: number;
    genest: { statistic: number; mean_asymptotic: number; p_mc: number; note?: string };
  };
  rows: PairRow[];
  matrix: number[][];
  z_matrix: number[][];
}

export interface NetworkSection {
  nodes: { id: number; frequency: number; degree_sig: number }[];
  edges: {
    source: number;
    target: number;
    weight: number;
    lift: number;
    z: number;
    q_bh: number;
    kind: 'significant' | 'exploratory';
  }[];
  criteria: { alpha: number; delta: number; exploratory_top: number };
}

export interface ItemsetRow {
  itemset: number[];
  observed: number;
  expected: number;
  null_prob: number;
  calibrated_lift: number;
  p: number;
  q_by: number;
  q_bh: number;
  sig_by: boolean;
  cond_given_pair: number[];
  cond_prob: number;
  cond_prob_null: number;
  conditional_lift: number;
}

export interface ItemsetsSection {
  rows: ItemsetRow[];
  summary: {
    n_candidates: number;
    expected_count: number;
    n_sig_by: number;
    n_raw_p05: number;
    top_pairs_used: number;
    note: string;
  };
  size_expectations: { size: number; prob: number; expected: number }[];
}

export interface ItemsetQuery {
  items?: number[] | null;
  target?: number[] | null;
  given?: number[] | null;
  cohort: Cohort;
  draw_to?: number | null;
}

export interface ItemsetStat {
  itemset: number[];
  size: number;
  observed: number;
  expected: number;
  null_prob: number;
  calibrated_lift: number;
  p: number;
  power_note: string | null;
}

export interface ItemsetQueryResult {
  T: number;
  draw_from: number;
  draw_to: number;
  itemset?: ItemsetStat;
  conditional?: {
    target: number[];
    given: number[];
    n_given: number;
    n_both: number;
    cond_prob: number;
    cond_prob_null: number;
    conditional_lift: number;
    p: number;
    union: ItemsetStat;
    T: number;
  };
}

export interface GroupScheme {
  kind: 'hypergeom' | 'mc';
  n_group?: number;
  support: number[];
  observed_counts: number[];
  expected_counts: number[];
  observed_mean: number;
  expected_mean: number;
  chi2: number;
  df: number;
  p: number;
  cells_after_merge: number;
  null_quantiles?: Record<string, number>;
}

export interface GroupsSection {
  T: number;
  schemes: Record<string, GroupScheme>;
}

/** S2.13 회차간 교차 공출현 — 전회차 번호(prev) → 후회차 번호(next). */
export interface CrossDrawRow {
  prev: number;
  next: number;
  observed: number;
  expected: number;
  expected_cond: number;
  lift: number | null;
  cond_lift: number | null;
  z: number;
  p: number;
  p_holm: number;
  q_bh: number;
  q_by: number;
  sig_bh: boolean;
  p_maxT?: number;
  sig_fwer?: boolean;
}
export interface CrossDrawBlock {
  summary: {
    n_pairs: number;
    n_cells: number;
    expected: number;
    max_abs_z: number;
    max_cell: [number, number];
    max_cell_p_maxT: number | null;
    n_sig_bh: number;
    n_sig_by: number;
    n_sig_fwer: number | null;
    n_raw_p05: number;
    expected_false_positives_raw: number;
    repeat: { observed: number; expected: number; expected_cond: number; z: number };
  };
  rows: CrossDrawRow[];
  matrix: number[][];
  z_matrix: number[][];
}
export interface CrossDrawLagBlock extends CrossDrawBlock {
  lag: number;
  draw_pairs: { first: [number, number]; last: [number, number] };
}
export interface CrossDrawSection {
  T: number;
  N: number;
  max_lag: number;
  p_cell: number;
  cell_semantics: string;
  statistic: string;
  window: CrossDrawBlock & { lags: number[] };
  lags: CrossDrawLagBlock[];
  any_lag: { max_abs_z: number; lag: number; cell: [number, number]; p_maxT: number; n_tests: number } | null;
  coverage: {
    draw_from: number;
    draw_to: number;
    max_lag: number;
    effective_max_lag: number;
    n_draws_partial_head: number;
    n_draws_partial_tail: number;
    partial_head: Array<{ draw_no: number; as_next: number }>;
    partial_tail: Array<{ draw_no: number; as_prev: number }>;
    note: string;
  };
  alerts: string[];
  note: string;
}

export interface TemporalSection {
  T: number;
  overlap: {
    series: number[];
    draw_no: number[];
    support: number[];
    observed_counts: number[];
    expected_counts: number[];
    mean: number;
    expected_mean: number;
    chi2: number;
    df: number;
    p_chi2: number;
    lag_means: number[];
    max_overlap: number;
    n_ge3: number;
    p_ge3_null: number;
    expected_ge3: number;
    p_mc_mean: number;
  };
  autocorr: {
    lags: number[];
    matrix: number[][];
    q_bh_matrix: number[][];
    n_sig_bh: number;
    n_tests: number;
    max_abs_lag1: number;
    argmax_lag1_number: number;
    lag1_p_maxT: number[];
    lag1_maxT_min_p: number;
  };
  runs: { number: number; runs: number; expected: number; z: number; p: number; q_bh: number }[];
  runs_n_sig_bh: number;
  gap: { n: number; mean: number; expected_mean: number; max: number; current_gaps: number[]; ks_p: number };
  ljung_box: Record<string, { lb_stat: number; p: number; lags: number }>;
  changepoint: {
    cusum_max: number;
    cusum_number: number;
    cusum_draw_no: number;
    cusum_p_mc: number;
    pelt_breakpoints_draw_no: number[];
    pelt_note?: string;
  };
  rolling: { start_draw_no: number; end_draw_no: number; x2: number; max_abs_z: number }[];
  alerts: string[];
}

export interface WinnersModelSection {
  features: string[];
  family: string;
  n: number;
  coef: Record<string, number>;
  se: Record<string, number>;
  p: Record<string, number>;
  alpha: number;
  mean_winners: number;
  interpretation: Record<string, string>;
  [k: string]: unknown;
}

// ---------- 검증 ----------
export interface ValidationMeta {
  validation_id: string;
  run_id_a: string | null;
  params: Record<string, unknown>;
  status: JobStatus;
  progress: number;
  stage: string | null;
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface ValidationIn {
  strategies?: string[] | null;
  tickets_per_draw?: number | null;
  from_draw?: number | null;
  to_draw?: number | null;
  seed?: number | null;
  insert_draws: boolean;
}

export interface ValidationMetaDetail {
  from_draw: number;
  to_draw: number;
  n_draws_b: number;
  tickets_per_draw: number;
  strategies: string[];
  seed: number;
  run_id_a: string | null;
  batch_id: string;
  inserted_b_draws: number;
  winners_model_used: boolean;
  policy: string;
}

export type RankKey = 'rank1' | 'rank2' | 'rank3' | 'rank4' | 'rank5';

export interface StrategyPerf {
  label?: string;
  n_tickets: number;
  n_draws: number;
  match_hist: number[];
  match_hist_expected: number[];
  mean_matches: number;
  expected_matches: number;
  z: number;
  p: number;
  rank_counts: Record<RankKey, number>;
  rank_expected: Record<RankKey, number>;
  n_ge3: number;
  expected_ge3: number;
  p_ge3_binomial: number;
  total_prize: number;
  total_cost: number;
  roi: number;
  max_matches: number;
  p_max_matches_null: number;
  curve: { draw_no: number; cum_matches: number; cum_expected: number; n_tickets?: number; prize?: number }[];
}

export interface ComparisonVsUniform {
  n_draws: number;
  mean_diff: number;
  ci95: [number, number];
  p_paired_t?: number;
  verdict: string;
}

export interface BacktestResult {
  strategies: Record<string, StrategyPerf>;
  comparison_vs_uniform: Record<string, ComparisonVsUniform>;
}

export interface ScoringEntry {
  brier_mean: number;
  log_score_mean: number;
  n_draws: number;
  brier_diff_vs_uniform?: { mean: number; ci95: [number, number]; better: boolean };
  log_diff_vs_uniform?: { mean: number; ci95: [number, number]; better: boolean };
}
export type ScoringResult = Record<string, ScoringEntry | string>;

export interface ReplicationBlock {
  n_candidates_a_raw: number;
  n_sig_bh_a: number;
  n_replicated_same_dir_p05: number;
  replication_rate: number;
  expected_rate_under_h0: number;
  detail: { key: number | number[]; z_a: number; p_a: number; z_b: number; p_b: number; replicated: boolean }[];
}
export interface ReplicationResult {
  numbers: ReplicationBlock;
  pairs: ReplicationBlock;
  pair_lift_corr_a_b: { r: number; p: number; expected: number };
  number_z_corr_a_b: { r: number; p: number; expected: number };
  T_a: number;
  T_b: number;
  run_id_a: string | null;
  note: string;
}

export interface HomogeneityResult {
  chi2: number;
  df: number;
  p_naive: number;
  chi2_adjusted: number;
  p_adjusted: number;
  counts_a: number[];
  counts_b: number[];
  verdict: string;
}

export type ValidationKind = 'meta' | 'backtest' | 'scoring' | 'replication' | 'homogeneity';

// ---------- 추천 / 스코어카드 ----------
export interface StrategyInfo {
  id: string;
  label: string;
  basis: string;
  expectation: string;
}

export interface Scorecard {
  numbers: number[];
  bonus: number | null;
  /** 보너스 지정 시: 본번호 중복 여부·보너스 번호가 본번호로 출현한 횟수 */
  bonus_info?: { in_main: boolean; observed_as_main: number | null } | null;
  history_T: number;
  per_number: { number: number; observed: number; expected: number; z: number; p: number; current_gap: number }[];
  pairs: { a: number; b: number; observed: number; expected: number; calibrated_lift: number; z: number }[];
  mean_pair_lift: number;
  typicality: {
    features: Record<string, number>;
    per_feature: Record<string, { value: number; percentile: number; null_mean: number; null_sd: number }>;
    mahalanobis: number;
    typicality_p: number;
    note: string;
  };
  history: { exact_6: number; match_5: number; match_4: number; match_3: number; mean_matches_past: number; expected_mean: number };
  match_distribution: Record<string, number>;
  rank_probabilities: Record<RankKey, number>;
  expected_matches: number;
  winners: {
    predicted_first_prize_winners: number;
    uniform_reference_mean: number;
    relative_index: number;
    percentile_among_uniform: number;
    note: string;
  } | null;
  policy: string;
}

export interface RecommendIn {
  strategy: string;
  count?: number | null;
  seed?: number | null;
  max_shared?: number | null;
  include_control: boolean;
  save: boolean;
}

/** 과거 회차 1·2등 일치 (PRD S4.9). rank 1 = 본번호 6개 동일, 2 = 5개 + 보너스. */
export interface PastWin {
  draw_no: number;
  rank: 1 | 2;
}

export interface RecommendTicket {
  rec_id: number | string | null;
  ticket: number[];
  scorecard: Scorecard;
  past_wins?: PastWin[];
}

export interface DiffVsUniform {
  mean: number;
  ci95: [number, number] | number[];
  n_draws: number;
  p_paired_t: number | null;
  verdict: string;
}

export interface RecommendSet {
  strategy: string;
  label: string;
  basis: string;
  expectation: string;
  is_control: boolean;
  meta: Record<string, unknown>;
  params_used: Record<string, number>;
  experiment: {
    experiment_id: string;
    iteration: number;
    holdout: DiffVsUniform | null;
    holdout_mean: number | null;
    verdict: string | null;
  } | null;
  tickets: RecommendTicket[];
}

export interface AnalysisBasis {
  run_id_a: string | null;
  history_T: number;
  train_end_draw: number;
  cohort_note: string;
  top_abs_z_numbers: { number: number; z: number }[];
  top_lift_pairs: { a: number; b: number; lift: number }[];
  winners_model_used: boolean;
}

export interface RecommendResponse {
  batch_id: string;
  target_draw_no: number;
  history_T: number;
  count: number;
  seed: number;
  run_id: string | null;
  sets: RecommendSet[];
  analysis_basis: AnalysisBasis;
  policy: string;
}

/** S4.11 추천 생성(순차). */
export interface SequentialIn {
  strategies?: string[] | null;
  count?: number | null;
  seed?: number | null;
  max_shared?: number | null;
  save: boolean;
}
export interface SequentialResponse {
  sequence_id: string;
  target_draw_no: number | null;
  strategies: string[];
  results: RecommendResponse[];
  failed: Array<{ strategy: string; error: string }>;
  total_tickets: number;
}

// S4.13 SEED 값 생성 (무작위 탐색)
export interface SeedSearchIn {
  target_draw_no?: number | null;
  target_rank: number; // 1–5
}
export interface SeedSearchJob {
  job_id: string;
  status: 'running' | 'done' | 'stopped' | 'error';
  target_draw_no: number;
  compare_draw_no: number;
  target_rank: number;
  iterations: number;
  seed: number | null;
  matched_strategy: string | null;
  matched_ticket: number[] | null;
  stop_reason: 'user' | 'max_iterations' | null;
  env_updated: boolean;
  max_iterations: number;
  elapsed_seconds: number;
  error: string | null;
}

export interface RecommendHistoryItem {
  rec_id: number;
  batch_id: string;
  strategy: string;
  ticket: number[];
  past_wins?: PastWin[];
  seed: number | null;
  target_draw_no: number | null;
  origin?: 'user' | 'backtest';
  scorecard: Partial<Scorecard> | null;
  params: Record<string, unknown> | null;
  created_at: string | null;
}

/** 내 번호로 자동 등록 (PRD S4.10). */
export interface AutoRegisterIn {
  target_draw_no?: number;
  seed?: number;
}
export interface AutoRegisterTicket {
  position: number;
  rec_id: number;
  ticket: number[];
  ticket_id?: number;
}
export interface AutoRegisterStrategy {
  strategy: string;
  label: string;
  batch_id: string;
  n_tickets: number;
  registered: AutoRegisterTicket[];
  merged_duplicates: (AutoRegisterTicket & { dup_count: number })[];
  missing_positions: number[];
}
export interface AutoRegisterResult {
  target_draw_no: number;
  rounds: number;
  pool: number;
  pick: number;
  seed: number;
  counts: Record<string, number>;
  selected: number[];
  strategies: AutoRegisterStrategy[];
  total_registered: number;
  total_merged: number;
  policy: string;
}

/** 추천 이력 필터 (PRD S4.6). limit 최대 50000 = 전체. */
export interface RecommendHistoryParams extends QueryParams {
  origin?: 'user' | 'backtest' | 'all';
  limit?: number;
  offset?: number;
  strategy?: string;
  batch_id?: string;
  target_draw_no?: number;
}

export interface RecommendHistorySummary {
  total_filtered: number;
  total_all: number;
  origin: 'user' | 'backtest' | 'all';
  by_origin: Record<string, number>;
  by_strategy: Record<string, number>;
  target_draws: number[];
  batches: { batch_id: string; created_at: string | null; count: number; target_draw_no: number }[];
}

// ---------- 실험 (전략 개선 루프, PRD §E9) ----------
export interface ParamSpec {
  default: number;
  min: number;
  max: number;
  type: 'float' | 'int';
  desc: string;
}
export interface StrategyParamInfo extends StrategyInfo {
  params: Record<string, ParamSpec>;
  defaults: Record<string, number>;
}
export interface ExperimentMetrics {
  n_tickets: number;
  n_draws: number;
  mean_matches: number | null;
  expected_matches: number;
  z: number | null;
  p: number | null;
  match_hist: number[];
  n_ge3: number;
  expected_ge3: number;
  brier_mean?: number;
  log_score_mean?: number;
  diff_vs_uniform?: DiffVsUniform;
  uniform?: ExperimentMetrics;
  best_index?: number;
  optimism?: number | null;
  verdict?: string;
}
export interface ExperimentCandidate {
  index: number;
  params: Record<string, number>;
  mean_matches: number | null;
  diff_vs_uniform: number | null;
  n_ge3: number;
  brier_mean: number | null;
}
export interface H0Benchmark {
  sd_single_diff: number;
  expected_best_diff: number;
  q50: number;
  q90: number;
  q95: number;
  q99: number;
  k: number;
  n_sims: number;
  observed_best_diff: number | null;
  percentile_of_observed: number | null;
  p_best_of_k: number | null;
  note: string;
}
export interface Experiment {
  experiment_id: string;
  name: string;
  strategy: string;
  params: Record<string, number>;
  parent_id: string | null;
  iteration: number;
  tune_from: number;
  tune_to: number;
  holdout_from: number;
  holdout_to: number;
  n_tickets: number;
  seed: number;
  search: 'random' | 'coordinate';
  n_candidates: number;
  candidates: ExperimentCandidate[];
  metrics_tune: ExperimentMetrics | Record<string, never>;
  metrics_holdout: ExperimentMetrics | Record<string, never>;
  h0_benchmark: H0Benchmark | Record<string, never>;
  status: JobStatus;
  progress: number;
  stage: string | null;
  error: string | null;
  is_active: boolean;
  created_at: string | null;
  finished_at: string | null;
}
export interface ExperimentIn {
  strategy: string;
  name?: string | null;
  base_params?: Record<string, number> | null;
  parent_id?: string | null;
  search?: 'random' | 'coordinate';
  n_candidates?: number;
  tune_from?: number | null;
  tune_to?: number | null;
  holdout_from?: number | null;
  holdout_to?: number | null;
  tickets_per_draw?: number | null;
  seed?: number | null;
  sync?: boolean;
}
export interface LineagePoint {
  experiment_id: string;
  iteration: number;
  created_at: string | null;
  params: Record<string, number>;
  is_active: boolean;
  tune_diff: number | null;
  tune_mean: number | null;
  holdout_diff: number | null;
  holdout_ci95: number[] | null;
  holdout_mean: number | null;
  holdout_z: number | null;
  optimism: number | null;
  p_best_of_k: number | null;
  cum_holdout_mean: number | null;
  cum_holdout_z: number | null;
}
export interface Lineage {
  strategy: string;
  points: LineagePoint[];
  trend: { spearman_rho: number; p: number; n: number; verdict: string } | null;
  note: string;
}

/** 티켓 단위 결과 필터 (PRD S8.6). limit ≤ 50000 = 전체. */
export interface OutcomeParams extends QueryParams {
  strategy?: string;
  draw_no?: number;
  source?: 'recommendation' | 'user';
  origin?: 'user' | 'backtest' | 'all';
  limit?: number;
  offset?: number;
}
export interface OutcomeSummary {
  total_filtered: number;
  total_all: number;
  origin: string;
  draw_nos: number[];
  strategies: Record<string, number>;
  by_source: Record<string, number>;
  by_origin: Record<string, number>;
}

// ---------- 사용자 번호 ----------
export interface TicketIn {
  numbers: number[];
  bonus?: number | null;
  label?: string | null;
  target_draw_no?: number | null;
}

export interface Outcome {
  outcome_id: number;
  source: string;
  ticket_ref: number;
  strategy: string;
  origin: string;
  draw_no: number;
  ticket: number[];
  past_wins?: PastWin[];
  main_matches: number;
  bonus_match: boolean;
  rank: number;
  prize_amount: number;
  evaluated_at: string;
}

export interface UserTicket {
  ticket_id: number;
  numbers: number[];
  bonus: number | null;
  label: string | null;
  target_draw_no: number | null;
  scorecard: {
    mean_pair_lift: number;
    typicality_p: number;
    features: Record<string, number>;
    winners: Scorecard['winners'];
    per_number_z: number[];
  } | null;
  dup_count?: number;
  dup_labels?: string[];
  same_number_ticket_ids?: number[];
  duplicate?: boolean;
  created_at: string;
  outcomes: Outcome[];
}

/** S5.7 현재 대상 회차 컨텍스트 (GET /user/tickets/draws). */
export interface TicketDraws {
  next_draw: number;
  latest_result_draw: number;
  active_target_draw: number;
  reason: 'next_recommended' | 'next_registered' | 'awaiting_next_recommendation' | 'none';
  draws: Array<{ target_draw_no: number; count: number; evaluated: boolean }>;
}

// ---------- 성과 추적 ----------
export type Origin = 'user' | 'backtest';

export interface ConsistencyStrategy {
  n_tickets: number;
  n_draws: number;
  insufficient: boolean;
  rank_dist: { rank: number; observed: number; expected: number; share: number; expected_share: number; p: number; q?: number }[];
  match_gof: { stat: number | null; df: number; p: number | null; bins: number; q?: number };
  number_corr: { mean_r: number | null; n_draws: number; t: number | null; p: number | null; q?: number; per_draw: { draw_no: number; r: number }[] };
  pair_corr: { pairs: number; hits: number; expected_hits: number; p0: number; mean_excess_rate: number | null; n_draws: number; t: number | null; p: number | null; q?: number };
  min_q: number | null;
  verdict: 'consistent' | 'deviation' | 'insufficient';
}

export interface ConsistencyReport {
  alpha: number;
  n_tests: number;
  origin: string;
  source: string;
  latest_draw: number | null;
  strategies: Record<string, ConsistencyStrategy>;
  feedback: {
    summary: string;
    n_deviation: number;
    actions: string[];
    next_experiment: { strategy: string; tune_to: number | null; note: string }[];
  };
  policy: string;
}

export interface TrackingSummary {
  strategies: Record<string, StrategyPerf>;
  comparison_vs_uniform: Record<string, ComparisonVsUniform>;
  n_outcomes: number;
  pending: PendingInfo;
  policy: string;
}

export interface PendingInfo {
  max_draw_in_db: number | null;
  recommendations: number;
  user_tickets: number;
  target_draws: number[];
}

export interface ResetRecommendResult {
  target_draw_no: number;
  deleted_recommendations: number;
  deleted_outcomes: number;
}
export interface ResetTicketsResult {
  target_draw_no: number;
  deleted_tickets: number;
  deleted_outcomes: number;
}

export const api = {
  health: () => get<Health>('/health'),
  config: () => get<AppConfig>('/api/v1/config'),

  data: {
    summary: () => get<DataSummary>('/api/v1/data/summary'),
    draws: (params?: { lo?: number; hi?: number; limit?: number; order?: 'asc' | 'desc' }) =>
      get<Draw[]>('/api/v1/data/draws', params),
    draw: (drawNo: number) => get<Draw>(`/api/v1/data/draws/${drawNo}`),
    imports: (limit?: number) => get<ImportReport[]>('/api/v1/data/imports', { limit }),
    importFile: (file: File, overwrite = false) => {
      const fd = new FormData();
      fd.append('file', file);
      return request<ImportReport>('/api/v1/data/import', { method: 'POST', body: fd }, { overwrite });
    },
    addDraw: (body: DrawIn) => post<ImportReport>('/api/v1/data/draws', body),
  },

  analysis: {
    runs: (limit?: number) => get<RunMeta[]>('/api/v1/analysis/runs', { limit }),
    latest: (cohort?: Cohort) => get<RunMeta>('/api/v1/analysis/runs/latest', { cohort }),
    run: (runId: string) => get<RunMeta>(`/api/v1/analysis/runs/${runId}`),
    create: (body: RunCreate) => post<RunMeta>('/api/v1/analysis/runs', body),
    remove: (runId: string) => del<unknown>(`/api/v1/analysis/runs/${runId}`),
    section: <T = unknown>(runId: string, section: Section) =>
      get<T>(`/api/v1/analysis/runs/${runId}/${section}`),
    itemsetQuery: (body: ItemsetQuery) => post<ItemsetQueryResult>('/api/v1/analysis/itemsets/query', body),
  },

  validation: {
    runs: (limit?: number) => get<ValidationMeta[]>('/api/v1/validation/runs', { limit }),
    latest: () => get<ValidationMeta>('/api/v1/validation/runs/latest'),
    run: (id: string) => get<ValidationMeta>(`/api/v1/validation/runs/${id}`),
    create: (body: ValidationIn) => post<ValidationMeta>('/api/v1/validation/runs', body),
    result: <T = unknown>(id: string, kind: ValidationKind) => get<T>(`/api/v1/validation/runs/${id}/${kind}`),
  },

  recommend: {
    strategies: () => get<StrategyInfo[]>('/api/v1/recommend/strategies'),
    create: (body: RecommendIn) => post<RecommendResponse>('/api/v1/recommend', body),
    sequential: (body: SequentialIn) => post<SequentialResponse>('/api/v1/recommend/sequential', body),
    history: (params?: RecommendHistoryParams) => get<RecommendHistoryItem[]>('/api/v1/recommend/history', params),
    historySummary: (params?: Omit<RecommendHistoryParams, 'limit' | 'offset'>) =>
      get<RecommendHistorySummary>('/api/v1/recommend/history/summary', params),
    autoRegister: (body: AutoRegisterIn) => post<AutoRegisterResult>('/api/v1/recommend/auto-register', body),
    // S4.13 SEED 값 생성
    seedSearchStart: (body: SeedSearchIn) => post<SeedSearchJob>('/api/v1/recommend/seed-search', body),
    seedSearchStatus: (jobId: string) => get<SeedSearchJob>(`/api/v1/recommend/seed-search/${jobId}`),
    seedSearchStop: (jobId: string) => post<SeedSearchJob>(`/api/v1/recommend/seed-search/${jobId}/stop`),
    // S4.12 현재 회차(미지정 시 최신+1)의 사용자 생성 추천 초기화
    reset: (targetDrawNo?: number) =>
      del<ResetRecommendResult>(`/api/v1/recommend/history${targetDrawNo ? `?target_draw_no=${targetDrawNo}` : ''}`),
  },

  experiments: {
    strategyParams: () => get<{ strategies: StrategyParamInfo[] }>('/api/v1/experiments/strategy-params'),
    create: (body: ExperimentIn) => post<Experiment>('/api/v1/experiments/runs', body),
    list: (strategy?: string, limit?: number) => get<Experiment[]>('/api/v1/experiments/runs', { strategy, limit }),
    get: (id: string) => get<Experiment>(`/api/v1/experiments/runs/${id}`),
    active: (strategy?: string) => get<Record<string, Experiment | null>>('/api/v1/experiments/active', { strategy }),
    lineage: (strategy: string) => get<Lineage>('/api/v1/experiments/lineage', { strategy }),
    activate: (id: string) => post<Experiment>(`/api/v1/experiments/runs/${id}/activate`),
    deactivate: (strategy: string) => post<{ strategy: string }>('/api/v1/experiments/deactivate', undefined, { strategy }),
    remove: (id: string) => del<{ deleted: string }>(`/api/v1/experiments/runs/${id}`),
  },

  user: {
    evaluate: (body: TicketIn) => post<Scorecard>('/api/v1/user/tickets/evaluate', body),
    save: (body: TicketIn) => post<UserTicket>('/api/v1/user/tickets', body),
    tickets: (limit?: number, targetDrawNo?: number | null) =>
      get<UserTicket[]>('/api/v1/user/tickets', { limit, target_draw_no: targetDrawNo ?? undefined }),
    ticketDraws: () => get<TicketDraws>('/api/v1/user/tickets/draws'),
    remove: (ticketId: number) => del<unknown>(`/api/v1/user/tickets/${ticketId}`),
    // S5.9 해당 대상 회차의 내 번호 초기화
    reset: (targetDrawNo: number) => del<ResetTicketsResult>(`/api/v1/user/tickets?target_draw_no=${targetDrawNo}`),
  },

  tracking: {
    summary: (origin?: Origin) => get<TrackingSummary>('/api/v1/tracking/summary', { origin }),
    // S8.7 추천 정합성 분석
    consistency: (origin: Origin | 'all' = 'user') => get<ConsistencyReport>('/api/v1/tracking/consistency', { origin }),
    outcomes: (params?: OutcomeParams) => get<Outcome[]>('/api/v1/tracking/outcomes', params),
    outcomesSummary: (params?: Omit<OutcomeParams, 'limit' | 'offset'>) =>
      get<OutcomeSummary>('/api/v1/tracking/outcomes/summary', params),
    pending: () => get<PendingInfo>('/api/v1/tracking/pending'),
    evaluate: (drawNo: number) => post<unknown>(`/api/v1/tracking/evaluate/${drawNo}`),
  },
};
