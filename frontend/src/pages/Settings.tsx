import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Cohort, type ImportReport, type Preset, type RunCreate, type RunMeta, type ValidationMeta } from '../api/client';
import { isActive, useRun } from '../hooks/useRun';
import DataTable, { type Column } from '../components/DataTable';
import Term from '../components/Term';
import { ErrorBox, Field, FormSlot, Loading, PageTitle, Section, btnCls, btnDangerCls, inputCls } from '../components/States';
import { fmtDate } from '../lib/format';
import { STATUS_LABEL } from '../lib/labels';
import { DrawEntryForms } from './Tracking';


const CONFIG_HELP: Record<string, string> = {
  app_name: '앱 이름',
  lotto_number_recommendation_count: '로또번호 추천 갯수 (LOTTO_NUMBER_RECOMMENDATION_COUNT, 1–50)',
  lotto_pool_size: '번호 풀 크기 (LOTTO_POOL_SIZE)',
  lotto_main_count: '본번호 개수 (LOTTO_MAIN_COUNT)',
  lotto_train_end_draw: '군 A 마지막 회차 — 이후는 군 B (LOTTO_TRAIN_END_DRAW)',
  lotto_significance_level: '유의수준 α (LOTTO_SIGNIFICANCE_LEVEL)',
  lotto_default_correction: '기본 다중비교 보정법 (LOTTO_DEFAULT_CORRECTION)',
  mc_iterations: 'MC 반복수 프리셋 quick/report/deep (LOTTO_MC_ITERATIONS[_REPORT|_DEEP])',
  lotto_random_seed: '기본 seed (LOTTO_RANDOM_SEED)',
  lotto_auto_rerun_preset: '새 회차 삽입 후 자동 재분석 프리셋 (LOTTO_AUTO_RERUN_PRESET, off 가능)',
  lotto_cross_draw_lag: '회차간 교차 공출현 전/후 간격 L (LOTTO_CROSS_DRAW_LAG, 1–50) — run 생성 시 고정, 변경 후 재분석 필요',
  lotto_min_effect_delta: '네트워크 엣지 최소 효과크기 |Lift*−1| (LOTTO_MIN_EFFECT_DELTA)',
  lotto_run_retention: '분석 run 보존 개수, 0=무제한 (LOTTO_RUN_RETENTION)',
  lotto_recent_draws: "내 번호 '저장된 번호' 타이틀 우측 최근 당첨번호 회차 수 (LOTTO_RECENT_DRAWS, 1–20)",
  lotto_exclude_trend_draws: "제외 번호 '자동' 동향 분석 대상 최근 회차 수 (LOTTO_EXCLUDE_TREND_DRAWS, 3–200)",
  lotto_exclude_recent_draws: "제외 번호 '자동' 직전 N회 교집합 필터·무작위 추출 개수 상한 (LOTTO_EXCLUDE_RECENT_DRAWS, 1–50)",
  lotto_lottery_pick_count: "내 번호 '등록된 번호로 추첨 시도' 선택(★) 개수 기본값 (LOTTO_LOTTERY_PICK_COUNT, 1–50) — 화면 입력 박스로 세션 단위 수정",
  lotto_prize_rank3_default: '3등 1게임당 당첨금 기본값 — 회차에 실제 값이 없을 때만 사용 (LOTTO_PRIZE_RANK3_DEFAULT)',
  lotto_prize_rank4_default: '4등 1게임당 고정 당첨금 (LOTTO_PRIZE_RANK4_DEFAULT)',
  lotto_prize_rank5_default: '5등 1게임당 고정 당첨금 (LOTTO_PRIZE_RANK5_DEFAULT)',
  timezone: '표시 시간대 (LOTTO_TIMEZONE)',
};

function NewRunForm() {
  const qc = useQueryClient();
  const config = useQuery({ queryKey: ['config'], queryFn: api.config });
  const [cohort, setCohort] = useState<Cohort>('ALL');
  const [preset, setPreset] = useState<Preset>('quick');
  const [seed, setSeed] = useState('');
  const [alpha, setAlpha] = useState('');
  const [correction, setCorrection] = useState('');
  const m = useMutation({
    mutationFn: (b: RunCreate) => api.analysis.create(b),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['analysis'] }),
  });
  return (
    <form
      className="grid items-start gap-2 sm:grid-cols-3 lg:grid-cols-6"
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate({
          cohort,
          preset,
          seed: seed ? Number(seed) : null,
          alpha: alpha ? Number(alpha) : null,
          correction: (correction || null) as RunCreate['correction'],
        });
      }}
    >
      <Field label="군">
        <select className={inputCls} value={cohort} onChange={(e) => setCohort(e.target.value as Cohort)}>
          <option value="A">A (1–{config.data?.lotto_train_end_draw ?? '…'})</option>
          <option value="B">B ({(config.data?.lotto_train_end_draw ?? 0) + 1}–)</option>
          <option value="ALL">A+B 전체</option>
        </select>
      </Field>
      <Field label="프리셋" hint={config.data ? `B = ${config.data.mc_iterations[preset].toLocaleString()}` : undefined}>
        <select className={inputCls} value={preset} onChange={(e) => setPreset(e.target.value as Preset)}>
          <option value="quick">quick</option>
          <option value="report">report</option>
          <option value="deep">deep</option>
        </select>
      </Field>
      <Field label="seed" hint={`기본 ${config.data?.lotto_random_seed ?? ''}`}>
        <input className={inputCls} type="number" value={seed} onChange={(e) => setSeed(e.target.value)} />
      </Field>
      <Field label="α" hint={`기본 ${config.data?.lotto_significance_level ?? ''}`}>
        <input className={inputCls} value={alpha} onChange={(e) => setAlpha(e.target.value)} inputMode="decimal" />
      </Field>
      <Field label="보정법" hint={`기본 ${config.data?.lotto_default_correction ?? ''}`}>
        <select className={inputCls} value={correction} onChange={(e) => setCorrection(e.target.value)}>
          <option value="">기본</option>
          <option value="fdr_bh">fdr_bh</option>
          <option value="fdr_by">fdr_by</option>
          <option value="holm">holm</option>
          <option value="bonferroni">bonferroni</option>
        </select>
      </Field>
      <FormSlot>
        <button type="submit" className={btnCls} disabled={m.isPending}>
        {m.isPending ? '요청 중…' : '새 분석 실행'}
        </button>
      </FormSlot>
      {m.isError && (
        <div className="sm:col-span-3 lg:col-span-6">
          <ErrorBox error={m.error} />
        </div>
      )}
    </form>
  );
}

export default function Settings() {
  const qc = useQueryClient();
  const config = useQuery({ queryKey: ['config'], queryFn: api.config });
  const summary = useQuery({ queryKey: ['data', 'summary'], queryFn: api.data.summary });
  const imports = useQuery({ queryKey: ['data', 'imports'], queryFn: () => api.data.imports(50) });
  const { runs, setRunId } = useRun();
  const vruns = useQuery({
    queryKey: ['validation', 'runs'],
    queryFn: () => api.validation.runs(50),
    refetchInterval: (q) => (q.state.data?.some((r) => isActive(r.status)) ? 2000 : 30_000),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.analysis.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['analysis'] }),
  });

  const runCols: Column<RunMeta>[] = [
    { key: 'created_at', label: '생성', render: (r) => fmtDate(r.created_at) },
    { key: 'cohort', label: <Term id="cohort" icon>군</Term> },
    { key: 'range', label: '회차', sortValue: (r) => r.draw_from, render: (r) => `${r.draw_from}–${r.draw_to} (${r.n_draws})` },
    { key: 'preset', label: '프리셋', render: (r) => <>{r.preset} · <Term id="mc">B</Term>={r.mc_iterations.toLocaleString()}</> },
    { key: 'alpha', label: <><Term id="alpha" icon>α</Term> / <Term id="multiple_testing" icon>보정</Term></>, sortable: false, render: (r) => `${r.alpha} / ${r.correction}` },
    { key: 'seed', label: 'seed', align: 'right' },
    { key: 'trigger', label: '트리거' },
    {
      key: 'status',
      label: '상태',
      render: (r) => (
        <span className="inline-flex items-center gap-1">
          {STATUS_LABEL[r.status] ?? r.status}
          {isActive(r.status) && (
            <>
              <progress className="h-1.5 w-16" max={1} value={r.progress} />
              <span className="text-xs tabular-nums">{Math.round(r.progress * 100)}%</span>
              <span className="text-xs text-neutral-500">{r.stage}</span>
            </>
          )}
          {r.error && <span className="text-xs text-red-600">{r.error}</span>}
        </span>
      ),
    },
    {
      key: 'diff_summary',
      label: '이전 run 대비',
      sortable: false,
      render: (r) => (r.diff_summary ? <span className="text-xs text-neutral-600 dark:text-neutral-300">{r.diff_summary}</span> : <span className="text-xs text-neutral-400">—</span>),
    },
    { key: 'run_id', label: 'run', render: (r) => <span className="font-mono text-xs">{r.run_id.slice(0, 8)}</span> },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (r) => (
        <span className="flex gap-1">
          {r.status === 'done' && (
            <button type="button" className="text-xs underline" onClick={() => setRunId(r.run_id)}>
              선택
            </button>
          )}
          <button type="button" className={btnDangerCls} disabled={remove.isPending || isActive(r.status)} onClick={() => confirm('이 run 을 삭제할까요?') && remove.mutate(r.run_id)}>
            삭제
          </button>
        </span>
      ),
    },
  ];
  const impCols: Column<ImportReport>[] = [
    { key: 'import_id', label: '#', align: 'right' },
    { key: 'created_at', label: '시각', render: (r) => fmtDate(r.created_at) },
    { key: 'filename', label: '파일' },
    { key: 'inserted', label: '삽입', align: 'right' },
    { key: 'skipped_duplicate', label: '중복 제외', align: 'right' },
    { key: 'conflicts', label: '충돌', align: 'right', sortValue: (r) => r.conflicts.length, render: (r) => r.conflicts.length },
    { key: 'invalid', label: '무효', align: 'right', sortValue: (r) => r.invalid.length, render: (r) => r.invalid.length },
    { key: 'triggered_run_id', label: '자동 재분석', render: (r) => <span className="font-mono text-xs">{r.triggered_run_id?.slice(0, 8) ?? '—'}</span> },
  ];
  const valCols: Column<ValidationMeta>[] = [
    { key: 'created_at', label: '생성', render: (r) => fmtDate(r.created_at) },
    { key: 'params', label: '파라미터', sortable: false, render: (r) => <span className="font-mono text-xs">{JSON.stringify(r.params)}</span> },
    { key: 'status', label: '상태', render: (r) => `${STATUS_LABEL[r.status] ?? r.status}${isActive(r.status) ? ` ${Math.round(r.progress * 100)}% ${r.stage ?? ''}` : ''}` },
    { key: 'finished_at', label: '완료', render: (r) => fmtDate(r.finished_at) },
    { key: 'validation_id', label: 'id', render: (r) => <span className="font-mono text-xs">{r.validation_id.slice(0, 8)}</span> },
  ];

  return (
    <div className="space-y-4">
      <PageTitle title="설정 / 실행" sub="환경 설정(읽기 전용), 데이터 적재, 분석·검증 실행 이력" />
      <Section title="설정 (.env.local)" right={<span className="text-xs text-neutral-500">값은 프로젝트 루트 .env.local 에서 로드되며 UI 에서 변경할 수 없습니다. 변경 후 backend 재시작.</span>}>
        {config.isLoading && <Loading />}
        {config.isError && <ErrorBox error={config.error} />}
        {config.data && (
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(config.data).map(([k, v]) => (
                <tr key={k} className="border-t border-neutral-100 dark:border-neutral-800">
                  <td className="py-1 pr-3 font-mono text-xs">{k}</td>
                  <td className="py-1 pr-3 tabular-nums">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</td>
                  <td className="py-1 text-xs text-neutral-500">{CONFIG_HELP[k] ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
      <Section
        title={<span className="text-lg font-bold text-indigo-800 dark:text-indigo-200">데이터 요약</span>}
        className="!border-2 !border-indigo-400 !bg-indigo-50/60 shadow-sm dark:!border-indigo-500 dark:!bg-indigo-950/30"
      >
        {summary.isLoading && <Loading />}
        {summary.isError && <ErrorBox error={summary.error} />}
        {summary.data && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-indigo-200 bg-white p-3 text-sm dark:border-indigo-800 dark:bg-neutral-900 md:grid-cols-4">
            <dt className="font-medium text-neutral-600 dark:text-neutral-300">총 회차</dt>
            <dd className="font-bold tabular-nums">
              {summary.data.total_draws.toLocaleString()} ({summary.data.min_draw}–{summary.data.max_draw})
            </dd>
            <dt className="font-medium text-neutral-600 dark:text-neutral-300">
              <Term id="cohort">군 A / B</Term>
            </dt>
            <dd className="font-bold tabular-nums">
              {summary.data.cohort_a_count} / {summary.data.cohort_b_count} (경계 {summary.data.train_end_draw})
            </dd>
            <dt className="font-medium text-neutral-600 dark:text-neutral-300">누락 회차</dt>
            <dd className="font-bold">{summary.data.missing_draws.length ? summary.data.missing_draws.join(', ') : '없음'}</dd>
            <dt className="font-medium text-neutral-600 dark:text-neutral-300">정합성</dt>
            <dd className="font-bold">
              {summary.data.integrity.contiguous ? '연속' : '불연속'} · {summary.data.integrity.all_sorted ? '정렬' : '비정렬'} · 무효 {summary.data.integrity.invalid_rows.length}
            </dd>
          </dl>
        )}
        <div className="mt-4">
          <DrawEntryForms />
        </div>
      </Section>
      <Section title="적재 이력">
        {imports.isLoading && <Loading />}
        {imports.data && <DataTable columns={impCols} rows={imports.data} rowKey={(r) => r.import_id} pageSize={10} dense initialSort={{ key: 'import_id', dir: 'desc' }} />}
      </Section>
      <Section title="분석 실행">
        <NewRunForm />
        <div className="mt-4">
          <DataTable columns={runCols} rows={runs} rowKey={(r) => r.run_id} pageSize={15} dense initialSort={{ key: 'created_at', dir: 'desc' }} />
        </div>
        {remove.isError && <ErrorBox error={remove.error} />}
      </Section>
      <Section title="검증 실행 이력">
        {vruns.isLoading && <Loading />}
        {vruns.data && <DataTable columns={valCols} rows={vruns.data} rowKey={(r) => r.validation_id} pageSize={10} dense initialSort={{ key: 'created_at', dir: 'desc' }} />}
      </Section>
    </div>
  );
}
