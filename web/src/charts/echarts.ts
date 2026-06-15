import {
  BarChart,
  LineChart,
  RadarChart,
} from 'echarts/charts';
import {
  DatasetComponent,
  GridComponent,
  LegendComponent,
  RadarComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { init, use } from 'echarts/core';

use([
  LineChart,
  RadarChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DatasetComponent,
  RadarComponent,
  CanvasRenderer,
]);

export { init };
