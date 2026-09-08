import { Link } from 'react-router-dom';
import type { FrequencySection, SummarySection } from '../api/client';
import { useRun, useSection } from '../hooks/useRun';
import { usePrefersDark } from '../hooks/usePrefersDark';
import KpiCard from '../components/KpiCard';
import PolicyBanner from '../components/PolicyBanner';
import PlotlyChart from '../components/PlotlyChart';
import RunPicker from '../components/RunPicker';
import Term from '../components/Term';
import VerdictBadge from '../components/VerdictBadge';
import { Empty, ErrorBox, Loading, PageTitle, Section } from '../components/States';
import { fmtNum, fmtP } from '../lib/format';
import { ACCENT, EXPECTED, OBSERVED } from '../lib/colors';
import { NAV } from '../lib/labels';

export function FrequencyDeviationChart({ freq, height = 300 }: { freq: FrequencySection; height?: number }) {
  const dark = usePrefersDark();
  const obs = dark ? OBSERVED.dark : OBSERVED.light;
  const exp = dark ? EXPECTED.dark : EXPECTED.light;
  const acc = dark ? ACCENT.dark : ACCENT.light;
  const xs = freq.rows.map((r) => r.number);
  return (
    <PlotlyChart
      height={height}
      data={[
        {
          type: 'bar',
          x: xs,
          y: freq.rows.map((r) => r.observed),
          name: '관측',
          marker: { color: freq.rows.map((r) => (r.sig_bh ? acc : obs)), line: { width: 0 } },
          customdata: freq.rows.map((r) => [r.z, r.p, r.q_bh]),
          hovertemplate: '번호 %{x}<br>관측 %{y}<br>z=%{customdata[0]:.2f} · p=%{customdata[1]:.3f} · q(BH)=%{customdata[2]:.3f}<extra></extra>',
        },
        {
          type: 'scatter',
          mode: 'lines',
          x: [0.5, 45.5],
          y: [freq.expected, freq.expected],
          name: `기대 ${fmtNum(freq.expected, 1)}`,
          line: { color: exp, width: 2 },
          hoverinfo: 'skip',
        },
      ]}
      layout={{
        shapes: [
          {
            type: 'rect',
            x0: 0.5,
            x1: 45.5,
            y0: freq.pi95[0],
            y1: freq.pi95[1],
            fillcolor: dark ? 'rgba(137,135,129,0.18)' : 'rgba(137,135,129,0.15)',
            line: { width: 0 },
            layer: 'below',
          },
        ],
        annotations: [
          { x: 45.5, y: freq.pi95[1], xanchor: 'right', yanchor: 'bottom', text: '95% 예측구간', showarrow: false, font: { size: 10, color: exp } },
        ],
        xaxis: { title: { text: '번호' }, dtick: 5, range: [0.4, 45.6] },
        yaxis: { title: { text: '출현 횟수' } },
        showlegend: true,
      }}
    />
  );
}

export default function Overview() {
  const { run, isLoading, error } = useRun();
  const summary = useSection<SummarySection>('summary');
  const freq = useSection<FrequencySection>('frequency');

  return (
    <div className="space-y-4">
      <PageTitle title="개요" sub="비복원추출 영가설 기준의 전역·개별·쌍 검정 요약" />
      <RunPicker />
      {isLoading && <Loading />}
      {error ? <ErrorBox error={error} title="backend 연결 실패" /> : null}
      {!isLoading && !error && !run && (
        <Empty>
          완료된 분석 run 이 없습니다. <Link className="underline" to="/settings">설정/실행</Link>에서 분석을 시작하세요.
        </Empty>
      )}
      {summary.isError && <ErrorBox error={summary.error} />}
      {summary.data && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <VerdictBadge ok={summary.data.verdict.consistent_with_uniform_null} />
            {summary.data.verdict.flags.map((f) => (
              <span key={f} className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                {f}
              </span>
            ))}
            <span className="text-xs text-neutral-500">
              T={summary.data.T.toLocaleString()} · <Term id="alpha">α</Term>={summary.data.alpha} · <Term id="multiple_testing">{summary.data.correction}</Term> · <Term id="mc">B</Term>={summary.data.mc_iterations.toLocaleString()} · seed {summary.data.seed}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="회차" value={`${summary.data.draw_from}–${summary.data.draw_to}`} sub={<><Term id="cohort">군 {summary.data.cohort}</Term> · {summary.data.T.toLocaleString()}회</>} />
            <KpiCard label={<Term id="joe_J" icon>전역 검정 Joe J (점근 p)</Term>} value={fmtP(summary.data.kpi.global_p_joe)} sub={<><Term id="mc">MC p</Term> = {fmtP(summary.data.kpi.global_p_mc)}</>} />
            <KpiCard label={<Term id="order_stat_Q" icon>순서통계 Q (MC p)</Term>} value={fmtP(summary.data.kpi.order_stat_p)} sub={<>자리별 평균의 <Term id="null_distribution">영분포</Term> 대비</>} />
            <KpiCard label={<Term id="genest" icon>Genest 쌍 통계 (MC p)</Term>} value={fmtP(summary.data.kpi.genest_p_mc)} sub="990쌍 전체 동시 검정" />
            <KpiCard
              label={<Term id="fdr_bh" icon>유의 번호 수</Term>}
              value={summary.data.kpi.n_sig_numbers_bh}
              sub={<>BH · <Term id="holm">Holm</Term> {summary.data.kpi.n_sig_numbers_holm}</>}
              tone={summary.data.kpi.n_sig_numbers_bh > 0 ? 'warn' : 'neutral'}
            />
            <KpiCard
              label={<Term id="fdr_bh" icon>유의 쌍 수</Term>}
              value={summary.data.kpi.n_sig_pairs_bh}
              sub={<>BH · <Term id="maxT">FWER(maxT)</Term> {summary.data.kpi.n_sig_pairs_fwer}</>}
              tone={summary.data.kpi.n_sig_pairs_bh > 0 ? 'warn' : 'neutral'}
            />
            <KpiCard
              label={<Term id="maxT" icon>최대 |z| 쌍 · maxT p</Term>}
              value={fmtP(summary.data.kpi.max_pair_p_maxT)}
              sub={`${summary.data.kpi.max_pair?.[0]}–${summary.data.kpi.max_pair?.[1]} · z=${fmtNum(summary.data.kpi.max_pair_z, 2)}`}
            />
            <KpiCard
              label={<Term id="autocorr" icon>시간 의존성 경보</Term>}
              value={summary.data.kpi.temporal_alerts?.length ?? 0}
              sub={<><Term id="overlap">overlap</Term> 평균 {fmtNum(summary.data.kpi.overlap_mean, 3)} (기대 0.8) · <Term id="cusum">CUSUM</Term> p {fmtP(summary.data.kpi.cusum_p_mc)}</>}
              tone={(summary.data.kpi.temporal_alerts?.length ?? 0) > 0 ? 'warn' : 'neutral'}
            />
          </div>
        </>
      )}
      {run && (
        <Section title="번호별 빈도 편차 (본번호)" right={<Link to="/frequency" className="text-xs underline">상세 →</Link>}>
          {freq.isLoading && <Loading />}
          {freq.isError && <ErrorBox error={freq.error} />}
          {freq.data && <FrequencyDeviationChart freq={freq.data} />}
        </Section>
      )}
      <PolicyBanner lines={summary.data?.interpretation_policy} />
      <Section title="바로가기">
        <div className="flex flex-wrap gap-2">
          {NAV.filter((n) => n.to !== '/').map((n) => (
            <Link key={n.to} to={n.to} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-800">
              {n.label}
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}
