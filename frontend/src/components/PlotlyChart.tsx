import { Suspense, lazy, useMemo } from 'react';
import type { PlotParams } from 'react-plotly.js';
import { usePrefersDark } from '../hooks/usePrefersDark';
import { INK } from '../lib/colors';
import { Loading } from './States';

const Plot = lazy(() => import('./PlotlyInner'));

export type PlotData = PlotParams['data'];
export type PlotLayout = PlotParams['layout'];
export type Trace = PlotData[number];

interface Props {
  data: PlotData;
  layout?: PlotLayout;
  height?: number;
  className?: string;
  onClick?: PlotParams['onClick'];
  config?: PlotParams['config'];
}

/** 테마(라이트/다크) 자동 반영 Plotly 래퍼. 배경 투명, 격자선은 은은하게. */
export default function PlotlyChart({ data, layout, height = 320, className = '', onClick, config }: Props) {
  const dark = usePrefersDark();
  const ink = dark ? INK.dark : INK.light;

  const merged = useMemo<PlotLayout>(() => {
    const base: PlotLayout = {
      autosize: true,
      height,
      margin: { l: 48, r: 16, t: 28, b: 40 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { family: 'system-ui, -apple-system, "Segoe UI", sans-serif', size: 12, color: ink.secondary },
      hovermode: 'closest',
      hoverlabel: { bgcolor: dark ? '#262624' : '#ffffff', bordercolor: ink.axis, font: { color: ink.primary } },
      legend: { orientation: 'h', y: -0.18, x: 0, font: { color: ink.secondary } },
      bargap: 0.25,
    };
    const axis = { gridcolor: ink.grid, zerolinecolor: ink.axis, linecolor: ink.axis, tickfont: { color: ink.muted } };
    const l = layout ?? {};
    return {
      ...base,
      ...l,
      xaxis: { ...axis, ...(l.xaxis ?? {}) },
      yaxis: { ...axis, ...(l.yaxis ?? {}) },
      margin: { ...base.margin, ...(l.margin ?? {}) },
      legend: { ...base.legend, ...(l.legend ?? {}) },
    };
  }, [layout, height, dark, ink]);

  return (
    <div className={`w-full ${className}`} style={{ minHeight: height }}>
      <Suspense fallback={<Loading text="차트 로딩…" />}>
        <Plot
          data={data}
          layout={merged}
          config={{ displaylogo: false, responsive: true, modeBarButtonsToRemove: ['lasso2d', 'select2d'], ...(config ?? {}) }}
          useResizeHandler
          style={{ width: '100%', height }}
          onClick={onClick}
        />
      </Suspense>
    </div>
  );
}
