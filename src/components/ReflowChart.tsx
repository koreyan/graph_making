import React, { useMemo } from 'react';
import Highcharts from 'highcharts/highstock';
import HighchartsReactOfficial from 'highcharts-react-official';
import type { ReflowDataPoint } from '../utils/csvParser';
import { THRESHOLDS } from '../utils/reflowAnalyzer';
import type { SolderType } from '../utils/reflowAnalyzer';

// HighchartsReact can sometimes be an object containing the component in 'default'
const HighchartsReact = (HighchartsReactOfficial as any).default || HighchartsReactOfficial;

interface ReflowChartProps {
  data: ReflowDataPoint[];
  solderType: SolderType;
}

const ReflowChart: React.FC<ReflowChartProps> = ({ data, solderType }) => {
  const thresholds = THRESHOLDS[solderType];

  const seriesData = useMemo(() => {
    return data
      .filter(d => !isNaN(d.temp2))
      .map(d => [d.time, d.temp2]);
  }, [data]);

  const annotations = useMemo(() => {
    if (data.length === 0) return [];

    const series2 = data.filter(d => !isNaN(d.temp2));
    if (series2.length === 0) return [];

    const peak = series2.reduce((prev, curr) => (prev.temp2 > curr.temp2 ? prev : curr));
    
    // Dynamic Phase Detection Logic based on solder type thresholds
    const soakStart = series2.find(d => d.temp2 >= thresholds.soakStartTemp);
    const soakEnd = series2.find(d => d.temp2 >= thresholds.soakEndTemp);
    const reflowStart = series2.find(d => d.temp2 >= thresholds.liquidusTemp);
    const reflowEnd = [...series2].reverse().find(d => d.temp2 >= thresholds.liquidusTemp);
    const lastPoint = series2[series2.length - 1];

    const labels: any[] = [];
    
    // 1. Peak Annotation
    labels.push({
      point: { x: peak.time, y: peak.temp2, xAxis: 0, yAxis: 0 },
      text: `Peak Temp: ${peak.temp2.toFixed(1)}°C`
    });

    // 2. Preheat/Soak Annotation
    if (soakStart && soakEnd) {
      labels.push({
        point: { x: (soakStart.time + soakEnd.time) / 2, y: (thresholds.soakStartTemp + thresholds.soakEndTemp) / 2, xAxis: 0, yAxis: 0 },
        text: `Preheat & Soak Zone\n(${soakEnd.time - soakStart.time}s)`
      });
    }

    // 3. Reflow (TAL) Annotation
    if (reflowStart && reflowEnd) {
      labels.push({
        point: { x: (reflowStart.time + reflowEnd.time) / 2, y: thresholds.liquidusTemp + 15, xAxis: 0, yAxis: 0 },
        text: `Reflow (TAL: ${reflowEnd.time - reflowStart.time}s)`
      });
    }

    // 4. Ramp Up
    if (soakStart) {
      labels.push({
        point: { x: soakStart.time / 2, y: (25 + thresholds.soakStartTemp) / 2, xAxis: 0, yAxis: 0 },
        text: 'Initial Ramp-Up'
      });
    }
    
    // 5. Ramp Down
    if (reflowEnd && lastPoint) {
      labels.push({
        point: { x: (reflowEnd.time + lastPoint.time) / 2, y: (thresholds.liquidusTemp + 100) / 2, xAxis: 0, yAxis: 0 },
        text: 'Cooling (Ramp-Down)'
      });
    }

    return [{
      draggable: 'xy',
      labelOptions: {
        backgroundColor: 'rgba(30, 30, 30, 0.85)',
        borderColor: '#3b82f6',
        borderRadius: 4,
        borderWidth: 1,
        style: { color: '#ffffff', fontSize: '10px', fontWeight: 'normal' }
      },
      labels
    }];
  }, [data, solderType, thresholds]);

  const options: Highcharts.Options = useMemo(() => {
    const series2 = data.filter(d => !isNaN(d.temp2));
    const soakStart = series2.find(d => d.temp2 >= thresholds.soakStartTemp);
    const soakEnd = series2.find(d => d.temp2 >= thresholds.soakEndTemp);
    const reflowEnd = [...series2].reverse().find(d => d.temp2 >= thresholds.liquidusTemp);
    const lastPoint = series2[series2.length - 1];

    const plotBands: Highcharts.XAxisPlotBandsOptions[] = [];

    // Add visual backgrounds for the reflow profile zones if data exists
    if (series2.length > 0) {
      const soakStartTime = soakStart ? soakStart.time : 60;
      const soakEndTime = soakEnd ? soakEnd.time : 180;
      const reflowEndTime = reflowEnd ? reflowEnd.time : 300;
      const endTime = lastPoint ? lastPoint.time : 480;

      plotBands.push(
        {
          from: 0,
          to: soakStartTime,
          color: 'rgba(0, 120, 212, 0.03)', // Cool blue for initial ramp-up
          label: {
            text: 'Initial Ramp-Up',
            align: 'center',
            verticalAlign: 'bottom',
            y: -15,
            style: { color: 'rgba(255, 255, 255, 0.35)', fontSize: '10px', fontWeight: 'bold' }
          }
        },
        {
          from: soakStartTime,
          to: soakEndTime,
          color: 'rgba(255, 165, 0, 0.03)', // Warm orange for soak
          label: {
            text: 'Preheat & Soak (Soak)',
            align: 'center',
            verticalAlign: 'bottom',
            y: -15,
            style: { color: 'rgba(255, 255, 255, 0.35)', fontSize: '10px', fontWeight: 'bold' }
          }
        },
        {
          from: soakEndTime,
          to: reflowEndTime,
          color: 'rgba(255, 77, 77, 0.04)', // Reflow zone
          label: {
            text: 'Reflow & Peak (Reflow)',
            align: 'center',
            verticalAlign: 'bottom',
            y: -15,
            style: { color: 'rgba(255, 255, 255, 0.35)', fontSize: '10px', fontWeight: 'bold' }
          }
        },
        {
          from: reflowEndTime,
          to: endTime,
          color: 'rgba(0, 204, 153, 0.02)', // Soft green for cooling
          label: {
            text: 'Cooling (Ramp-Down)',
            align: 'center',
            verticalAlign: 'bottom',
            y: -15,
            style: { color: 'rgba(255, 255, 255, 0.35)', fontSize: '10px', fontWeight: 'bold' }
          }
        }
      );
    }

    return {
      chart: {
        type: 'line',
        backgroundColor: '#1e1e1e', // Match premium bg color
        zoomType: 'x',
        style: { fontFamily: 'Inter, sans-serif' }
      },
      title: {
        text: `Reflow Temperature Profile Analysis (${solderType === 'pb-free' ? 'SAC305 Pb-Free' : 'Sn63/Pb37 Leaded'})`,
        style: { color: '#ffffff', fontSize: '14px', fontWeight: 'bold' }
      },
      xAxis: {
        title: { text: 'Elapsed Time (Seconds)', style: { color: '#888888', fontSize: '11px' } },
        labels: { style: { color: '#888888', fontSize: '10px' } },
        gridLineColor: 'rgba(255, 255, 255, 0.04)',
        gridLineWidth: 1,
        tickInterval: 30,
        min: 0,
        max: lastPoint ? Math.max(480, lastPoint.time) : 480,
        crosshair: {
          width: 1,
          color: 'rgba(255, 255, 255, 0.15)',
          dashStyle: 'Dash'
        },
        plotBands
      },
      yAxis: {
        title: { text: 'Temperature (°C)', style: { color: '#888888', fontSize: '11px' } },
        labels: { style: { color: '#888888', fontSize: '10px' } },
        gridLineColor: 'rgba(255, 255, 255, 0.04)',
        gridLineWidth: 1,
        tickInterval: 50,
        min: 0,
        max: 300,
        plotLines: [
          {
            value: thresholds.liquidusTemp,
            color: 'rgba(255, 77, 77, 0.6)',
            dashStyle: 'Dash',
            width: 1.5,
            label: {
              text: `Liquidus (${thresholds.liquidusTemp}°C)`,
              style: { color: '#ff4d4d', fontWeight: 'bold', fontSize: '9px' },
              align: 'right',
              x: -10
            }
          },
          {
            value: thresholds.soakStartTemp,
            color: 'rgba(255, 165, 0, 0.4)',
            dashStyle: 'Dash',
            width: 1.2,
            label: {
              text: `Preheat Start (${thresholds.soakStartTemp}°C)`,
              style: { color: '#ffa500', fontSize: '9px' },
              align: 'right',
              x: -10
            }
          },
          {
            value: thresholds.soakEndTemp,
            color: 'rgba(255, 165, 0, 0.4)',
            dashStyle: 'Dash',
            width: 1.2,
            label: {
              text: `Preheat End (${thresholds.soakEndTemp}°C)`,
              style: { color: '#ffa500', fontSize: '9px' },
              align: 'right',
              x: -10
            }
          }
        ]
      },
      series: [
        {
          name: 'Thermocouple 2 (TC2)',
          type: 'line',
          data: seriesData,
          color: '#3b82f6', // Premium blue curve
          lineWidth: 2.5,
          shadow: {
            color: 'rgba(59, 130, 246, 0.2)',
            width: 4
          },
          marker: {
            enabled: false,
            states: {
              hover: {
                enabled: true,
                radius: 5,
                fillColor: '#3b82f6',
                lineWidth: 1.5,
                lineColor: '#ffffff'
              }
            }
          }
        }
      ],
      annotations: annotations as any,
      tooltip: {
        shared: true,
        useHTML: true,
        backgroundColor: '#1f2937',
        borderColor: '#374151',
        borderRadius: 8,
        borderWidth: 1,
        style: {
          color: '#ffffff',
          fontSize: '12px'
        },
        headerFormat: '<div style="font-size: 10px; color: #9ca3af; font-weight: bold; margin-bottom: 4px;">Time: {point.key}s</div>',
        pointFormat: '<div style="display: flex; align-items: center; gap: 6px;"><span style="color: #3b82f6; font-size: 14px;">●</span> <b>{series.name}</b>: <span style="color: #60a5fa; font-weight: bold;">{point.y:.1f}°C</span></div>',
        shadow: true
      },
      legend: { enabled: false },
      exporting: {
        buttons: {
          contextButton: {
            enabled: false
          }
        }
      },
      plotOptions: {
        series: {
          animation: false,
          stickyTracking: true,
          findNearestPointBy: 'x'
        }
      }
    };
  }, [data, solderType, thresholds, seriesData, annotations]);

  if (!HighchartsReact) {
    return <div style={{ color: '#ef4444', padding: '20px', textAlign: 'center' }}>Error: HighchartsReact component failed to load.</div>;
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <HighchartsReact 
        highcharts={Highcharts} 
        options={options} 
        containerProps={{ style: { height: '100%', width: '100%' } }}
      />
    </div>
  );
};

export default ReflowChart;
