import type { Scorecard } from '../api/client';
import { fmtNum, fmtP, fmtPct } from '../lib/format';
import { ACCENT, OBSERVED } from '../lib/colors';
import { usePrefersDark } from '../hooks/usePrefersDark';
import DataTable, { type Column } from './DataTable';
import PlotlyChart from './PlotlyChart';
import PValueBadge from './PValueBadge';
import { BallRow } from './LottoBall';
import PolicyBanner from './PolicyBanner';
import Term from './Term';
import { FEATURE_LABEL } from '../lib/labels';

/** 압축 스코어카드 한 줄 (추천 카드용). */
export function ScorecardCompact({ sc }: { sc: Scorecard }) {
  return (
    <dl className="grid grid-cols-3 gap-2 text-xs">
      <div>
        <dt className="text-neutral-500">
          <Term id="calibrated_lift">평균 쌍 lift*</Term>
        </dt>
        <dd className="font-medium tabular-nums">{fmtNum(sc.mean_pair_lift, 3)}</dd>
      </div>
      <div>
        <dt className="text-neutral-500">
          <Term id="typicality">전형성 p</Term>
        </dt>
        <dd className="font-medium tabular-nums">{fmtP(sc.typicality?.typicality_p)}</dd>
      </div>
      <div>
        <dt className="text-neutral-500">
          <Term id="winners_model">예상 공유자 지수</Term>
        </dt>
        <dd className="font-medium tabular-nums">{sc.winners ? fmtNum(sc.winners.relative_index, 3) : '—'}</dd>
      </div>
    </dl>
  );
}

type PerNumber = Scorecard['per_number'][number];
type PairRow = Scorecard['pairs'][number];

/** 전체 스코어카드 (§E5 S5.2). */
export default function ScorecardView({ sc, alpha = 0.05 }: { sc: Scorecard; alpha?: number }) {
  const dark = usePrefersDark();
  const perNumCols: Column<PerNumber>[] = [
    { key: 'number', label: '번호', render: (r) => <BallRow numbers={[r.number]} size="sm" /> },
    { key: 'observed', label: '관측', align: 'right' },
    { key: 'expected', label: '기대', align: 'right', render: (r) => fmtNum(r.expected, 1) },
    { key: 'z', label: <Term id="z_score" icon>z</Term>, align: 'right', render: (r) => fmtNum(r.z, 2) },
    { key: 'p', label: <Term id="p_value" icon>p</Term>, align: 'right', render: (r) => <PValueBadge p={r.p} alpha={alpha} sig={false} /> },
    { key: 'current_gap', label: '현재 미출현', align: 'right' },
  ];
  const pairCols: Column<PairRow>[] = [
    { key: 'pair', label: '쌍', render: (r) => `${r.a}–${r.b}`, sortValue: (r) => r.a * 100 + r.b },
    { key: 'observed', label: '관측', align: 'right' },
    { key: 'expected', label: '기대', align: 'right', render: (r) => fmtNum(r.expected, 2) },
    { key: 'calibrated_lift', label: <Term id="calibrated_lift" icon>Lift*</Term>, align: 'right', render: (r) => fmtNum(r.calibrated_lift, 3) },
    { key: 'z', label: <Term id="z_score" icon>z</Term>, align: 'right', render: (r) => fmtNum(r.z, 2) },
  ];
  const feats = Object.entries(sc.typicality?.per_feature ?? {});
  const md = Object.entries(sc.match_distribution ?? {}).sort((a, b) => Number(a[0]) - Number(b[0]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <BallRow numbers={sc.numbers} bonus={typeof sc.bonus === 'number' ? sc.bonus : null} />
        <span className="text-xs text-neutral-500">이력 T={sc.history_T}회</span>
        {sc.bonus_info && (
          <span className="text-xs text-neutral-500">
            보너스 {sc.bonus} · 본번호로 출현 {sc.bonus_info.observed_as_main ?? '—'}회 (보너스는 스코어카드 지표에 포함되지 않음)
          </span>
        )}
      </div>
      <ScorecardCompact sc={sc} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-1 text-sm font-semibold">번호별 빈도</h3>
          <DataTable columns={perNumCols} rows={sc.per_number} rowKey={(r) => r.number} dense />
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold">포함된 15개 쌍</h3>
          <DataTable columns={pairCols} rows={sc.pairs} rowKey={(r) => `${r.a}-${r.b}`} dense pageSize={15} initialSort={{ key: 'z', dir: 'desc' }} />
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold">
          조합 특성 — <Term id="null_distribution">영분포</Term> 분위수 <span className="ml-2 text-xs font-normal text-neutral-500"><Term id="typicality">전형성 p</Term> = {fmtP(sc.typicality?.typicality_p)} · Mahalanobis {fmtNum(sc.typicality?.mahalanobis, 2)}</span>
        </h3>
        <PlotlyChart
          height={260}
          data={[
            {
              type: 'bar',
              orientation: 'h',
              y: feats.map(([k]) => FEATURE_LABEL[k] ?? k),
              x: feats.map(([, v]) => v.percentile * 100),
              marker: { color: dark ? OBSERVED.dark : OBSERVED.light, line: { width: 0 } },
              text: feats.map(([, v]) => `${v.value} (영분포 평균 ${fmtNum(v.null_mean, 1)})`),
              hovertemplate: '%{y}: 분위수 %{x:.1f}%<br>%{text}<extra></extra>',
              name: '분위수',
            },
          ]}
          layout={{
            xaxis: { range: [0, 100], title: { text: '영분포 분위수 (%)' }, ticksuffix: '%' },
            yaxis: { automargin: true },
            shapes: [
              { type: 'line', x0: 50, x1: 50, y0: -0.5, y1: feats.length - 0.5, line: { color: dark ? ACCENT.dark : ACCENT.light, width: 1, dash: 'dot' } },
            ],
            showlegend: false,
            margin: { l: 120 },
          }}
        />
        <p className="text-xs text-neutral-500">{sc.typicality?.note}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div>
          <h3 className="mb-1 text-sm font-semibold">
            <Term id="match_distribution" icon>예상 일치수 분포</Term>
          </h3>
          <table className="w-full text-xs">
            <thead className="text-neutral-500">
              <tr>
                <th className="text-left">일치</th>
                <th className="text-right">확률</th>
              </tr>
            </thead>
            <tbody>
              {md.map(([k, v]) => (
                <tr key={k} className="border-t border-neutral-100 dark:border-neutral-800">
                  <td>{k}개</td>
                  <td className="text-right tabular-nums">{v < 0.0001 ? v.toExponential(2) : fmtPct(v, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[11px] text-neutral-500">
            <Term id="expected_matches">기대 일치수</Term> {fmtNum(sc.expected_matches, 2)} — 모든 조합 동일(<Term id="hypergeom">하이퍼지오메트릭</Term>).
          </p>
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold">과거 이력 일치</h3>
          <dl className="grid grid-cols-2 gap-1 text-xs">
            <dt className="text-neutral-500">6개 일치</dt>
            <dd className="tabular-nums">{sc.history?.exact_6}</dd>
            <dt className="text-neutral-500">5개 일치</dt>
            <dd className="tabular-nums">{sc.history?.match_5}</dd>
            <dt className="text-neutral-500">4개 일치</dt>
            <dd className="tabular-nums">{sc.history?.match_4}</dd>
            <dt className="text-neutral-500">3개 일치</dt>
            <dd className="tabular-nums">{sc.history?.match_3}</dd>
            <dt className="text-neutral-500">과거 평균 일치</dt>
            <dd className="tabular-nums">
              {fmtNum(sc.history?.mean_matches_past, 3)} (기대 {fmtNum(sc.history?.expected_mean, 2)})
            </dd>
          </dl>
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold">
            <Term id="winners_model" icon>당첨자수 모형</Term>
          </h3>
          {sc.winners ? (
            <dl className="grid grid-cols-2 gap-1 text-xs">
              <dt className="text-neutral-500">예상 1등 공유자</dt>
              <dd className="tabular-nums">{fmtNum(sc.winners.predicted_first_prize_winners, 2)}</dd>
              <dt className="text-neutral-500">균등 참조 평균</dt>
              <dd className="tabular-nums">{fmtNum(sc.winners.uniform_reference_mean, 2)}</dd>
              <dt className="text-neutral-500">상대 지수</dt>
              <dd className="tabular-nums font-medium">{fmtNum(sc.winners.relative_index, 3)}</dd>
              <dt className="text-neutral-500">균등 대비 백분위</dt>
              <dd className="tabular-nums">{fmtPct(sc.winners.percentile_among_uniform)}</dd>
            </dl>
          ) : (
            <p className="text-xs text-neutral-500">당첨자수 모형 없음</p>
          )}
          {sc.winners?.note && <p className="mt-1 text-[11px] text-neutral-500">{sc.winners.note}</p>}
        </div>
      </div>
      <PolicyBanner compact lines={sc.policy ? [sc.policy] : null} />
    </div>
  );
}
