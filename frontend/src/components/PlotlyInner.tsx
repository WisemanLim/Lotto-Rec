import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js-dist-min';

// plotly.js-dist-min 을 lazy 청크로 분리 — PlotlyChart 에서 React.lazy 로 로드.
const Plot = createPlotlyComponent(Plotly);
export default Plot;
