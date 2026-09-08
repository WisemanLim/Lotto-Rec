import { Fragment } from 'react';
import type { TemporalSection } from '../api/client';
import { useRun, useSection } from '../hooks/useRun';
import { usePrefersDark } from '../hooks/usePrefersDark';
import DataTable, { type Column } from '../components/DataTable';
import KpiCard from '../components/KpiCard';
import PValueBadge from '../components/PValueBadge';
import PlotlyChart, { type Trace } from '../components/PlotlyChart';
import RunPicker from '../components/RunPicker';
import Term from '../components/Term';
import { BallRow } from '../components/LottoBall';
import { Empty, ErrorBox, Loading, PageTitle, Section } from '../components/States';
import { fmtNum, fmtP } from '../lib/format';
import { ACCENT, EXPECTED, OBSERVED, divergingScale } from '../lib/colors';
import { FEATURE_LABEL } from '../lib/labels';

type RunRow = TemporalSection['runs'][number];

export default function Temporal() {
  const { run } = useRun();
  const t = useSection<TemporalSection>('temporal');
  const dark = usePrefersDark();
  const obs = dark ? OBSERVED.dark : OBSERVED.light;
  const exp = dark ? EXPECTED.dark : EXPECTED.light;
  const acc = dark ? ACCENT.dark : ACCENT.light;
  const alpha = run?.alpha ?? 0.05;

  const runCols: Column<RunRow>[] = [
    { key: 'number', label: '번호', render: (r) => <BallRow numbers={[r.number]} size="sm" /> },
    { key: 'runs', label: <Term id="runs_test" icon>runs</Term>, align: 'right' },
    { key: 'expected', label: '기대', align: 'right', render: (r) => fmtNum(r.expected, 1) },
    { key: 'z', label: <Term id="z_score" icon>z</Term>, align: 'right', render: (r) => fmtNum(r.z, 2) },
    { key: 'p', label: <Term id="p_value" icon>p</Term>, align: 'right', render: (r) => fmtP(r.p) },
    { key: 'q_bh', label: <Term id="fdr_bh" icon>q (BH)</Term>, align: 'right', render: (r) => <PValueBadge p={r.p} q={r.q_bh} alpha={alpha} /> },
  ];

  const d = t.data;
  return (
    <div className="space-y-4">
      <PageTitle title="시간 분석" sub="연속 회차 overlap, 번호별 자기상관·runs, 변화점(CUSUM/PELT), 이동 χ²" />
      <RunPicker />
      {!run && <Empty>완료된 분석 run 없음</Empty>}
      {t.isLoading && <Loading />}
      {t.isError && <ErrorBox error={t.error} />}
      {d && (
        <>
          {d.alerts.length > 0 ? (
            <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <b>시간 의존성 경보 ({d.alerts.length})</b>
              <ul className="list-disc pl-5">
                {d.alerts.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-neutral-500">시간 의존성 경보 없음.</p>
          )}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label={<Term id="overlap" icon>overlap 평균</Term>} value={fmtNum(d.overlap.mean, 3)} sub={<>기대 0.8 · <Term id="mc">MC p</Term> {fmtP(d.overlap.p_mc_mean)} · χ² p {fmtP(d.overlap.p_chi2)}</>} />
            <KpiCard label={<Term id="overlap" icon>overlap ≥3 횟수</Term>} value={d.overlap.n_ge3} sub={`기대 ${fmtNum(d.overlap.expected_ge3, 1)} · 최대 ${d.overlap.max_overlap}`} />
            <KpiCard label={<Term id="autocorr" icon>lag-1 최대 |자기상관|</Term>} value={fmtNum(d.autocorr.max_abs_lag1, 3)} sub={<>번호 {d.autocorr.argmax_lag1_number} · <Term id="maxT">maxT</Term> 최소 p {fmtP(d.autocorr.lag1_maxT_min_p)} · 유의(<Term id="fdr_bh">BH</Term>) {d.autocorr.n_sig_bh}/{d.autocorr.n_tests}</>} />
            <KpiCard label={<Term id="cusum" icon>CUSUM 최대</Term>} value={fmtNum(d.changepoint.cusum_max, 2)} sub={`번호 ${d.changepoint.cusum_number} @ ${d.changepoint.cusum_draw_no}회 · MC p ${fmtP(d.changepoint.cusum_p_mc)}`} tone={d.changepoint.cusum_p_mc < alpha ? 'warn' : 'neutral'} />
          </div>

          <Section title={<Term id="overlap" icon>연속 회차 overlap (t-1 과 공통 번호 수)</Term>}>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <PlotlyChart
                  height={260}
                  data={[
                    { type: 'scatter', mode: 'lines', x: d.overlap.draw_no, y: d.overlap.series, name: 'overlap', line: { color: obs, width: 1 }, hovertemplate: '%{x}회: %{y}<extra></extra>' },
                    { type: 'scatter', mode: 'lines', x: [d.overlap.draw_no[0], d.overlap.draw_no.at(-1)!], y: [0.8, 0.8], name: '기대 0.8', line: { color: exp, width: 2, dash: 'dot' }, hoverinfo: 'skip' },
                  ]}
                  layout={{ xaxis: { title: { text: '회차' } }, yaxis: { title: { text: '공통 번호 수' }, dtick: 1 }, showlegend: true }}
                />
              </div>
              <PlotlyChart
                height={260}
                data={[
                  { type: 'bar', x: d.overlap.support.map(String), y: d.overlap.observed_counts, name: '관측', marker: { color: obs, line: { width: 0 } } },
                  { type: 'bar', x: d.overlap.support.map(String), y: d.overlap.expected_counts, name: '기대', marker: { color: exp, line: { width: 0 } } },
                ]}
                layout={{ barmode: 'group', xaxis: { title: { text: 'overlap' } }, yaxis: { title: { text: '회차 수' } }, showlegend: true }}
              />
            </div>
            <p className="text-xs text-neutral-500">
              lag 별 overlap 평균: {d.overlap.lag_means.map((m, i) => `lag${i + 1} ${fmtNum(m, 3)}`).join(' · ')}
            </p>
          </Section>

          <Section title={<Term id="autocorr" icon>번호별 자기상관 (lag × 번호)</Term>}>
            <PlotlyChart
              height={300}
              data={[
                {
                  type: 'heatmap',
                  z: d.autocorr.matrix,
                  x: Array.from({ length: 45 }, (_, i) => i + 1),
                  y: d.autocorr.lags,
                  colorscale: divergingScale(dark),
                  zmid: 0,
                  zmin: -0.15,
                  zmax: 0.15,
                  colorbar: { title: { text: 'r' }, thickness: 10 },
                  customdata: d.autocorr.q_bh_matrix,
                  hovertemplate: '번호 %{x} · lag %{y}<br>r=%{z:.3f} · q(BH)=%{customdata:.3f}<extra></extra>',
                } as Trace,
              ]}
              layout={{ xaxis: { title: { text: '번호' }, dtick: 5 }, yaxis: { title: { text: 'lag' }, dtick: 1 } }}
            />
          </Section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section
              title={
                <>
                  <Term id="runs_test" icon>runs 검정</Term> (유의 BH {d.runs_n_sig_bh})
                </>
              }
            >
              <DataTable columns={runCols} rows={d.runs} rowKey={(r) => r.number} initialSort={{ key: 'z', dir: 'desc' }} pageSize={10} dense csvName="runs" />
            </Section>
            <Section
              title={
                <>
                  <Term id="cusum" icon>변화점</Term> · <Term id="gap" icon>간격</Term> · <Term id="ljung_box" icon>Ljung-Box</Term>
                </>
              }
            >
              <dl className="grid grid-cols-2 gap-1 text-sm">
                <dt className="text-neutral-500">
                  <Term id="cusum">CUSUM</Term> 최대 / 번호 / 회차
                </dt>
                <dd className="tabular-nums">
                  {fmtNum(d.changepoint.cusum_max, 3)} / {d.changepoint.cusum_number} / {d.changepoint.cusum_draw_no}회 (MC p {fmtP(d.changepoint.cusum_p_mc)})
                </dd>
                <dt className="text-neutral-500">
                  <Term id="pelt">PELT</Term> 변화점
                </dt>
                <dd>{d.changepoint.pelt_breakpoints_draw_no.length ? d.changepoint.pelt_breakpoints_draw_no.join(', ') : '없음'}</dd>
                <dt className="text-neutral-500">
                  <Term id="gap">간격</Term> 평균 / 기대 / 최대
                </dt>
                <dd className="tabular-nums">
                  {fmtNum(d.gap.mean, 3)} / {fmtNum(d.gap.expected_mean, 2)} / {d.gap.max}
                </dd>
                {Object.entries(d.ljung_box).map(([k, v]) => (
                  <Fragment key={k}>
                    <dt className="text-neutral-500">
                      <Term id="ljung_box">Ljung-Box</Term> {FEATURE_LABEL[k] ?? k} (lag {v.lags})
                    </dt>
                    <dd className="tabular-nums">
                      Q={fmtNum(v.lb_stat, 2)} · p <PValueBadge p={v.p} sig={false} />
                    </dd>
                  </Fragment>
                ))}
              </dl>
              {d.changepoint.pelt_note && <p className="mt-2 text-xs text-neutral-500">{d.changepoint.pelt_note}</p>}
              <h3 className="mt-3 mb-1 text-sm font-medium">현재 미출현 간격</h3>
              <PlotlyChart
                height={160}
                data={[{ type: 'bar', x: Array.from({ length: 45 }, (_, i) => i + 1), y: d.gap.current_gaps, marker: { color: obs, line: { width: 0 } }, hovertemplate: '번호 %{x}: %{y}회<extra></extra>' }]}
                layout={{ margin: { t: 4, b: 28, l: 32 }, xaxis: { dtick: 5 }, showlegend: false }}
              />
            </Section>
          </div>

          <Section title="이동 구간 χ² (100회 창)">
            <PlotlyChart
              height={240}
              data={[
                { type: 'scatter', mode: 'lines+markers', x: d.rolling.map((r) => r.end_draw_no), y: d.rolling.map((r) => r.x2), name: 'χ²', line: { color: obs, width: 2 }, marker: { size: 5 }, customdata: d.rolling.map((r) => [r.start_draw_no, r.max_abs_z]), hovertemplate: '%{customdata[0]}–%{x}회<br>χ²=%{y:.1f} · 최대|z|=%{customdata[1]:.2f}<extra></extra>' },
                { type: 'scatter', mode: 'lines', x: [d.rolling[0]?.end_draw_no ?? null, d.rolling.at(-1)?.end_draw_no ?? null], y: [44, 44], name: '기대 df=44', line: { color: exp, width: 2, dash: 'dot' }, hoverinfo: 'skip' },
                { type: 'scatter', mode: 'lines', x: d.rolling.map((r) => r.end_draw_no), y: d.rolling.map((r) => r.max_abs_z * 10), name: '최대|z| ×10', line: { color: acc, width: 1 }, visible: 'legendonly' },
              ]}
              layout={{ xaxis: { title: { text: '창 끝 회차' } }, yaxis: { title: { text: 'χ²' } }, showlegend: true }}
            />
          </Section>
        </>
      )}
    </div>
  );
}
