import React, { useMemo } from 'react';
import Highcharts from 'highcharts/highstock';
import HighchartsReactOfficial from 'highcharts-react-official';
import type { ReflowDataPoint } from '../utils/csvParser';
import type { SolderType, SolderThresholds } from '../utils/reflowAnalyzer';

// HighchartsReact can sometimes be an object containing the component in 'default'
const HighchartsReact = (HighchartsReactOfficial as any).default || HighchartsReactOfficial;

interface ReflowChartProps {
  data: ReflowDataPoint[];
  solderType: SolderType;
  customThresholds: SolderThresholds;
  scaleMode: 'standard' | 'auto-fit';
  solderComposition: string;
  conveyorSpeed: string;
  customAnnotations: Array<{ id: string; x: number; y: number; text: string }>;
  onAddAnnotation: (x: number, y: number) => void;
}

const ReflowChart: React.FC<ReflowChartProps> = ({
  data,
  solderType,
  customThresholds,
  scaleMode,
  solderComposition,
  conveyorSpeed,
  customAnnotations,
  onAddAnnotation,
}) => {
  const seriesData = useMemo(() => {
    return data
      .filter(d => !isNaN(d.temp2))
      .map(d => [d.time, d.temp2]);
  }, [data]);

  // Generate combined annotations: Calculated Phase Zones + User custom annotations
  const annotations = useMemo(() => {
    if (data.length === 0) return [];

    const series2 = data.filter(d => !isNaN(d.temp2));
    if (series2.length === 0) return [];

    const peak = series2.reduce((prev, curr) => (prev.temp2 > curr.temp2 ? prev : curr));
    
    // Dynamic Phase Detection Logic based on user-configured thresholds
    const soakStart = series2.find(d => d.temp2 >= customThresholds.soakStartTemp);
    const soakEnd = series2.find(d => d.temp2 >= customThresholds.soakEndTemp);
    const reflowStart = series2.find(d => d.temp2 >= customThresholds.liquidusTemp);
    const reflowEnd = [...series2].reverse().find(d => d.temp2 >= customThresholds.liquidusTemp);
    const lastPoint = series2[series2.length - 1];

    const labels: any[] = [];
    
    // 1. Peak Temp
    labels.push({
      point: { x: peak.time, y: peak.temp2, xAxis: 0, yAxis: 0 },
      text: `최고 온도: ${peak.temp2.toFixed(1)}°C`
    });

    // 2. Preheat/Soak Zone
    if (soakStart && soakEnd) {
      labels.push({
        point: { x: (soakStart.time + soakEnd.time) / 2, y: (customThresholds.soakStartTemp + customThresholds.soakEndTemp) / 2, xAxis: 0, yAxis: 0 },
        text: `예열 & 소크 영역\n(${soakEnd.time - soakStart.time}초)`
      });
    }

    // 3. Reflow (TAL) Zone
    if (reflowStart && reflowEnd) {
      labels.push({
        point: { x: (reflowStart.time + reflowEnd.time) / 2, y: customThresholds.liquidusTemp + 12, xAxis: 0, yAxis: 0 },
        text: `TAL 액상선 구간\n(${reflowEnd.time - reflowStart.time}초)`
      });
    }

    // 4. Initial Ramp Up
    if (soakStart) {
      labels.push({
        point: { x: soakStart.time / 2, y: (25 + customThresholds.soakStartTemp) / 2, xAxis: 0, yAxis: 0 },
        text: '초기 승온'
      });
    }
    
    // 5. Ramp Down (Cooling)
    if (reflowEnd && lastPoint) {
      labels.push({
        point: { x: (reflowEnd.time + lastPoint.time) / 2, y: (customThresholds.liquidusTemp + 100) / 2, xAxis: 0, yAxis: 0 },
        text: '냉각 하강'
      });
    }

    // Add user custom annotations
    customAnnotations.forEach(ann => {
      labels.push({
        point: { x: ann.x, y: ann.y, xAxis: 0, yAxis: 0 },
        text: ann.text,
        backgroundColor: 'rgba(59, 130, 246, 0.95)', // Cyan highlight for custom annotations
        borderColor: '#1e3a8a',
        style: { color: '#ffffff', fontWeight: 'bold' }
      });
    });

    return [{
      draggable: 'xy',
      labelOptions: {
        backgroundColor: 'rgba(30, 30, 32, 0.85)',
        borderColor: '#4b5563',
        borderRadius: 6,
        borderWidth: 1,
        padding: 6,
        style: { color: '#ffffff', fontSize: '10px', fontFamily: 'Inter, sans-serif' }
      },
      labels
    }];
  }, [data, customThresholds, customAnnotations]);

  const options: Highcharts.Options = useMemo(() => {
    const series2 = data.filter(d => !isNaN(d.temp2));
    const soakStart = series2.find(d => d.temp2 >= customThresholds.soakStartTemp);
    const soakEnd = series2.find(d => d.temp2 >= customThresholds.soakEndTemp);
    const reflowEnd = [...series2].reverse().find(d => d.temp2 >= customThresholds.liquidusTemp);
    const lastPoint = series2[series2.length - 1];

    const plotBands: Highcharts.XAxisPlotBandsOptions[] = [];

    // Construct background highlights based on dynamic timestamps
    if (series2.length > 0) {
      const soakStartTime = soakStart ? soakStart.time : 60;
      const soakEndTime = soakEnd ? soakEnd.time : 180;
      const reflowEndTime = reflowEnd ? reflowEnd.time : 300;
      const endTime = lastPoint ? lastPoint.time : 480;

      plotBands.push(
        {
          from: 0,
          to: soakStartTime,
          color: 'rgba(59, 130, 246, 0.03)', // Soft blue for initial ramp-up
          label: {
            text: '초기 승온 (Ramp-Up)',
            align: 'center',
            verticalAlign: 'bottom',
            y: -15,
            style: { color: 'rgba(255, 255, 255, 0.35)', fontSize: '10px', fontWeight: 'bold' }
          }
        },
        {
          from: soakStartTime,
          to: soakEndTime,
          color: 'rgba(245, 158, 11, 0.03)', // Warm orange for soak preheat
          label: {
            text: '예열 소크 (Preheat & Soak)',
            align: 'center',
            verticalAlign: 'bottom',
            y: -15,
            style: { color: 'rgba(255, 255, 255, 0.35)', fontSize: '10px', fontWeight: 'bold' }
          }
        },
        {
          from: soakEndTime,
          to: reflowEndTime,
          color: 'rgba(239, 68, 68, 0.04)', // Hot red for Reflow TAL
          label: {
            text: '리플로우 피크 (Reflow & Peak)',
            align: 'center',
            verticalAlign: 'bottom',
            y: -15,
            style: { color: 'rgba(255, 255, 255, 0.35)', fontSize: '10px', fontWeight: 'bold' }
          }
        },
        {
          from: reflowEndTime,
          to: endTime,
          color: 'rgba(16, 185, 129, 0.02)', // Clean green for cooling
          label: {
            text: '하강 냉각 (Cooling)',
            align: 'center',
            verticalAlign: 'bottom',
            y: -15,
            style: { color: 'rgba(255, 255, 255, 0.35)', fontSize: '10px', fontWeight: 'bold' }
          }
        }
      );
    }

    // Determine scale bounds dynamically based on Scale Mode state
    let xAxisMax = 480;
    let yAxisMax = 300;

    if (scaleMode === 'auto-fit' && series2.length > 0) {
      const dataMaxTime = Math.max(...series2.map(d => d.time));
      const dataMaxTemp = Math.max(...series2.map(d => d.temp2));
      xAxisMax = Math.ceil((dataMaxTime + 30) / 30) * 30;
      yAxisMax = Math.ceil((dataMaxTemp + 20) / 50) * 50;
    } else if (lastPoint) {
      xAxisMax = Math.max(480, lastPoint.time);
    }

    return {
      chart: {
        type: 'line',
        backgroundColor: '#16161a', // Rich premium dark theme background
        zoomType: 'x',
        style: { fontFamily: 'Inter, sans-serif' }
      },
      title: {
        text: `리플로우 온도 프로파일 분석 (${solderType === 'pb-free' ? 'SAC305 Pb-Free 무연' : 'Sn63/Pb37 Leaded 유연'})`,
        style: { color: '#ffffff', fontSize: '14px', fontWeight: 'bold' }
      },
      subtitle: {
        text: `화학 조성비: ${solderComposition || 'N/A'}  |  컨베이어 벨트 속도: ${conveyorSpeed || 'N/A'}`,
        style: { color: '#9ca3af', fontSize: '12px', fontWeight: '500' }
      },
      xAxis: {
        title: { text: '경과 시간 (Elapsed Time - Seconds)', style: { color: '#9ca3af', fontSize: '11px' } },
        labels: { style: { color: '#9ca3af', fontSize: '10px' } },
        gridLineColor: 'rgba(255, 255, 255, 0.04)',
        gridLineWidth: 1,
        tickInterval: 30,
        min: 0,
        max: xAxisMax,
        crosshair: {
          width: 1,
          color: 'rgba(255, 255, 255, 0.15)',
          dashStyle: 'Dash'
        },
        plotBands
      },
      yAxis: {
        title: { text: '온도 (Temperature - °C)', style: { color: '#9ca3af', fontSize: '11px' } },
        labels: { style: { color: '#9ca3af', fontSize: '10px' } },
        gridLineColor: 'rgba(255, 255, 255, 0.04)',
        gridLineWidth: 1,
        tickInterval: 50,
        min: 0,
        max: yAxisMax,
        plotLines: [
          {
            value: customThresholds.liquidusTemp,
            color: 'rgba(239, 68, 68, 0.75)',
            dashStyle: 'Dash',
            width: 2,
            label: {
              text: `액상선 (Liquidus: ${customThresholds.liquidusTemp}°C)`,
              style: { color: '#fca5a5', fontWeight: 'bold', fontSize: '9px' },
              align: 'right',
              x: -10
            }
          },
          {
            value: customThresholds.soakStartTemp,
            color: 'rgba(245, 158, 11, 0.55)',
            dashStyle: 'Dash',
            width: 1.5,
            label: {
              text: `예열 소크 시작 (${customThresholds.soakStartTemp}°C)`,
              style: { color: '#fcd34d', fontSize: '9px' },
              align: 'right',
              x: -10
            }
          },
          {
            value: customThresholds.soakEndTemp,
            color: 'rgba(245, 158, 11, 0.55)',
            dashStyle: 'Dash',
            width: 1.5,
            label: {
              text: `예열 소크 끝 (${customThresholds.soakEndTemp}°C)`,
              style: { color: '#fcd34d', fontSize: '9px' },
              align: 'right',
              x: -10
            }
          }
        ]
      },
      series: [
        {
          name: '열전쌍 채널 2 (TC2)',
          type: 'line',
          data: seriesData,
          color: '#3b82f6', // Glowing core signal line
          lineWidth: 3,
          shadow: {
            color: 'rgba(59, 130, 246, 0.25)',
            width: 6
          },
          marker: {
            enabled: false,
            states: {
              hover: {
                enabled: true,
                radius: 6,
                fillColor: '#3b82f6',
                lineWidth: 2,
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
        headerFormat: '<div style="font-size: 10px; color: #9ca3af; font-weight: bold; margin-bottom: 4px;">경과 시간: {point.key}초</div>',
        pointFormat: '<div style="display: flex; align-items: center; gap: 6px;"><span style="color: #3b82f6; font-size: 14px;">●</span> <b>{series.name}</b>: <span style="color: #60a5fa; font-weight: bold;">{point.y:.1f}°C</span></div>',
        footerFormat: '<div style="font-size: 9px; color: #9ca3af; margin-top: 4px; border-top: 1px solid #374151; padding-top: 4px;">💡 클릭하여 사용자 주석(메모) 추가 가능</div>',
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
          findNearestPointBy: 'x',
          point: {
            events: {
              click: function(e: any) {
                const point = e.point;
                onAddAnnotation(point.x, point.y);
              }
            }
          }
        }
      }
    };
  }, [data, solderType, customThresholds, scaleMode, solderComposition, conveyorSpeed, seriesData, annotations, onAddAnnotation]);

  if (!HighchartsReact) {
    return <div style={{ color: '#ef4444', padding: '20px', textAlign: 'center' }}>Error: HighchartsReact component failed to load.</div>;
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }} className="reflow-chart-container">
      <HighchartsReact 
        highcharts={Highcharts} 
        options={options} 
        containerProps={{ style: { height: '100%', width: '100%' } }}
      />
    </div>
  );
};

export default ReflowChart;
