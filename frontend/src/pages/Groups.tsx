import type { GroupScheme, GroupsSection } from '../api/client';
import { useRun, useSection } from '../hooks/useRun';
import { usePrefersDark } from '../hooks/usePrefersDark';
import DataTable, { type Column } from '../components/DataTable';
import PValueBadge from '../components/PValueBadge';
import PlotlyChart from '../components/PlotlyChart';
import RunPicker from '../components/RunPicker';
import Term from '../components/Term';
import { Empty, ErrorBox, Loading, PageTitle, Section } from '../components/States';
import { FEATURE_LABEL } from '../lib/labels';
import { fmtNum } from '../lib/format';
import { EXPECTED, OBSERVED } from '../lib/colors';

type Row = GroupScheme & { name: string };

function SchemeChart({ name, s }: { name: string; s: GroupScheme }) {
  const dark = usePrefersDark();
  // MC 스킴(합 등)은 support 가 길어 0 기대 셀을 제외해 표시
  const idx = s.support.map((_, i) => i).filter((i) => s.expected_counts[i] > 0.05 || s.observed_counts[i] > 0);
  const x = idx.map((i) => s.support[i]);
  const isWide = x.length > 30;
  return (
    <div className="rounded-md border border-neutral-200 p-2 dark:border-neutral-700">
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-medium">{FEATURE_LABEL[name] ?? name}</span>
        <span className="text-xs text-neutral-500">
          {s.kind === 'hypergeom' ? <Term id="hypergeom">하이퍼지오메트릭</Term> : <Term id="mc">MC</Term>} · χ²={fmtNum(s.chi2, 2)} (df {s.df}) · <Term id="p_value">p</Term> <PValueBadge p={s.p} sig={false} />
        </span>
      </div>
      <PlotlyChart
        height={200}
        data={
          isWide
            ? [
                { type: 'bar', x, y: idx.map((i) => s.observed_counts[i]), name: '관측', marker: { color: dark ? OBSERVED.dark : OBSERVED.light, line: { width: 0 } } },
                { type: 'scatter', mode: 'lines', x, y: idx.map((i) => s.expected_counts[i]), name: '기대', line: { color: dark ? EXPECTED.dark : EXPECTED.light, width: 2 } },
              ]
            : [
                { type: 'bar', x: x.map(String), y: idx.map((i) => s.observed_counts[i]), name: '관측', marker: { color: dark ? OBSERVED.dark : OBSERVED.light, line: { width: 0 } } },
                { type: 'bar', x: x.map(String), y: idx.map((i) => s.expected_counts[i]), name: '기대', marker: { color: dark ? EXPECTED.dark : EXPECTED.light, line: { width: 0 } } },
              ]
        }
        layout={{ barmode: 'group', margin: { l: 40, t: 8, b: 32 }, xaxis: { title: { text: '값' } }, showlegend: true, legend: { y: 1.1, orientation: 'h' } }}
      />
      <div className="text-xs text-neutral-500">
        관측 평균 {fmtNum(s.observed_mean, 3)} · 기대 평균 {fmtNum(s.expected_mean, 3)}
        {s.null_quantiles && (
          <>
            {' · '}
            <Term id="null_distribution">영분포</Term> [2.5%, 50%, 97.5%] = {s.null_quantiles.q025}, {s.null_quantiles.q50}, {s.null_quantiles.q975}
          </>
        )}
      </div>
    </div>
  );
}

export default function Groups() {
  const { run } = useRun();
  const groups = useSection<GroupsSection>('groups');
  const alpha = run?.alpha ?? 0.05;
  const rows: Row[] = groups.data ? Object.entries(groups.data.schemes).map(([name, s]) => ({ name, ...s })) : [];
  const cols: Column<Row>[] = [
    { key: 'name', label: '특성', render: (r) => FEATURE_LABEL[r.name] ?? r.name },
    { key: 'kind', label: <Term id="null_distribution" icon>영분포</Term>, render: (r) => (r.kind === 'hypergeom' ? <Term id="hypergeom">하이퍼지오메트릭</Term> : <Term id="mc">MC</Term>) },
    { key: 'observed_mean', label: '관측 평균', align: 'right', render: (r) => fmtNum(r.observed_mean, 3) },
    { key: 'expected_mean', label: '기대 평균', align: 'right', render: (r) => fmtNum(r.expected_mean, 3) },
    { key: 'chi2', label: 'χ²', align: 'right', render: (r) => fmtNum(r.chi2, 2) },
    { key: 'df', label: 'df', align: 'right' },
    { key: 'cells_after_merge', label: '셀(병합 후)', align: 'right' },
    { key: 'p', label: <Term id="p_value" icon>p</Term>, align: 'right', render: (r) => <PValueBadge p={r.p} alpha={alpha} /> },
  ];
  return (
    <div className="space-y-4">
      <PageTitle title="그룹 패턴" sub="홀짝·저고·구간·합·연속·끝수 등 조합 특성의 관측 분포 vs 이론(비복원) 분포" />
      <RunPicker />
      {!run && <Empty>완료된 분석 run 없음</Empty>}
      {groups.isLoading && <Loading />}
      {groups.isError && <ErrorBox error={groups.error} />}
      {groups.data && (
        <>
          <Section
            title={
              <>
                <Term id="group_pattern" icon>요약</Term> (T={groups.data.T.toLocaleString()})
              </>
            }
          >
            <DataTable columns={cols} rows={rows} rowKey={(r) => r.name} dense csvName="groups" />
            <p className="mt-2 text-xs text-neutral-500">{rows.length}개 특성을 동시에 검정하므로 개별 <Term id="p_value">p</Term>&lt;0.05 는 <Term id="exploratory">탐색 후보</Term>로만 해석.</p>
          </Section>
          <div className="grid gap-3 md:grid-cols-2">
            {rows.map((r) => (
              <SchemeChart key={r.name} name={r.name} s={r} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
