import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  Download, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Info,
  Thermometer,
  Trash2,
  Plus,
  FileSpreadsheet,
  Printer,
  FolderOpen
} from 'lucide-react';
import Highcharts from 'highcharts/highstock';
import AnnotationsModule from 'highcharts/modules/annotations';
import ExportingModule from 'highcharts/modules/exporting';
import OfflineExportingModule from 'highcharts/modules/offline-exporting';
import { parseCSV } from './utils/csvParser';
import type { ReflowDataPoint, ReflowMetaData } from './utils/csvParser';
import { generateMockReflowData } from './utils/mockData';
import { analyzeReflowProfile, THRESHOLDS } from './utils/reflowAnalyzer';
import type { SolderType, SolderThresholds } from './utils/reflowAnalyzer';
import ReflowChart from './components/ReflowChart';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import './index.css';

// Initialize Highcharts modules
if (typeof AnnotationsModule === 'function') {
  (AnnotationsModule as any)(Highcharts);
}
if (typeof ExportingModule === 'function') {
  (ExportingModule as any)(Highcharts);
}
if (typeof OfflineExportingModule === 'function') {
  (OfflineExportingModule as any)(Highcharts);
}

export interface ZoneTemperatures {
  z1Top: number;
  z1Bot: number;
  z2Top: number;
  z2Bot: number;
  z3Top: number;
  z3Bot: number;
  z4Top: number;
  z4Bot: number;
}

const DEFAULT_ZONE_TEMPS: Record<'pb-free' | 'leaded', ZoneTemperatures> = {
  'pb-free': {
    z1Top: 150, z1Bot: 150,
    z2Top: 180, z2Bot: 180,
    z3Top: 250, z3Bot: 245,
    z4Top: 130, z4Bot: 130
  },
  'leaded': {
    z1Top: 110, z1Bot: 110,
    z2Top: 150, z2Bot: 150,
    z3Top: 220, z3Bot: 215,
    z4Top: 100, z4Bot: 100
  }
};

const App: React.FC = () => {
  const [data, setData] = useState<ReflowDataPoint[]>([]);
  const [meta, setMeta] = useState<ReflowMetaData | null>(null);
  const [solderType, setSolderType] = useState<SolderType>('pb-free');
  
  // Tabs and File List state
  const [activeLeftTab, setActiveLeftTab] = useState<'settings' | 'files'>('files');
  const [csvFileList, setCsvFileList] = useState<{name: string, path: string}[]>([]);
  const [currentDirPath, setCurrentDirPath] = useState<string | null>(null);
  
  // Custom process conditions
  const [solderComposition, setSolderComposition] = useState<string>('SAC305');
  const [conveyorSpeed, setConveyorSpeed] = useState<string>('1.2 mm/s');
  
  // Oven Zone Temperatures state (as raw string inputs for smooth editing)
  const [zoneTemps, setZoneTemps] = useState<Record<keyof ZoneTemperatures, string>>(() => {
    const defaults = DEFAULT_ZONE_TEMPS['pb-free'];
    const init = {} as any;
    for (const k in defaults) {
      init[k] = String(defaults[k as keyof ZoneTemperatures]);
    }
    return init;
  });

  const handleZoneTempChange = (key: keyof ZoneTemperatures, val: string) => {
    setZoneTemps(prev => ({
      ...prev,
      [key]: val
    }));
  };
  
  // Dynamic threshold overrides state (as raw string inputs for smooth editing)
  const [customThresholds, setCustomThresholds] = useState<Record<keyof SolderThresholds, string>>(() => {
    const defaults = THRESHOLDS['pb-free'];
    const init = {} as any;
    for (const k in defaults) {
      init[k] = String(defaults[k as keyof SolderThresholds]);
    }
    return init;
  });

  // Chart Scale mode: standard (0-480s, 0-300C) vs auto-fit
  const [scaleMode, setScaleMode] = useState<'standard' | 'auto-fit'>('standard');
  
  // Interactive custom annotations state
  const [customAnnotations, setCustomAnnotations] = useState<Array<{ id: string; x: number; y: number; text: string }>>([]);

  // Manual annotation inputs state
  const [manualAnnX, setManualAnnX] = useState<string>('');
  const [manualAnnY, setManualAnnY] = useState<string>('');
  const [manualAnnText, setManualAnnText] = useState<string>('');

  // Solder Solder Preset click handler
  const handlePresetSelect = (type: 'pb-free' | 'leaded') => {
    setSolderType(type);
    setSolderComposition(type === 'pb-free' ? 'SAC305' : 'Sn63/Pb37');
    setConveyorSpeed(type === 'pb-free' ? '1.2 mm/s' : '1.0 mm/s');

    const zoneDefaults = DEFAULT_ZONE_TEMPS[type];
    const newZoneStrings = {} as any;
    for (const key in zoneDefaults) {
      newZoneStrings[key] = String(zoneDefaults[key as keyof ZoneTemperatures]);
    }
    setZoneTemps(newZoneStrings);

    const defaults = THRESHOLDS[type];
    const newThresholdStrings = {} as any;
    for (const key in defaults) {
      newThresholdStrings[key] = String(defaults[key as keyof SolderThresholds]);
    }
    setCustomThresholds(newThresholdStrings);
  };

  // Sync custom threshold changes
  const handleThresholdChange = (key: keyof SolderThresholds, val: string) => {
    setCustomThresholds(prev => ({
      ...prev,
      [key]: val
    }));
  };

  // Memoized parsed numeric representation of state for analytics & charts
  const parsedZoneTemps = useMemo<ZoneTemperatures>(() => {
    const parsed = {} as any;
    for (const k in zoneTemps) {
      const val = zoneTemps[k as keyof ZoneTemperatures];
      parsed[k] = val === '' ? NaN : parseFloat(val);
    }
    return parsed;
  }, [zoneTemps]);

  const parsedThresholds = useMemo<SolderThresholds>(() => {
    const parsed = {} as any;
    for (const k in customThresholds) {
      const val = customThresholds[k as keyof SolderThresholds];
      parsed[k] = val === '' ? NaN : parseFloat(val);
    }
    return parsed;
  }, [customThresholds]);

  // Load sample demo data
  const loadDemoData = () => {
    const mockData = generateMockReflowData();
    setData(mockData);
    setMeta({
      deviceName: 'TCTempX4 Reflow Oven',
      deviceDescription: '4 채널 열전지 온도 데이터 로거 (데모)',
      serialNumber: 'SN-REFLOW-T15168',
      deviceId: 'MultiChannelDemo',
      channels: ['채널 2 (TC2)', '채널 4', '채널 6', '채널 8']
    });
    setCustomAnnotations([
      { id: '1', x: 250, y: 255.0, text: '최고 용융 도달점 - 접합 최적화' }
    ]);
  };

  // Handle uploaded file (CSV or XLSX)
  const handleFileUpload = useCallback(async (file: File) => {
    try {
      let contentToParse: File | string = file;
      
      if (window.electronAPI && (file as any).path) {
        const res = await window.electronAPI.readCsvFile((file as any).path);
        if (res.error) throw new Error(res.error);
        if (res.content) contentToParse = res.content;
      } else if (file.name.toLowerCase().endsWith('.xlsx')) {
        throw new Error('웹 브라우저 단독 환경에서는 .xlsx 파일을 파싱할 수 없습니다. 데스크톱 앱을 사용해주세요.');
      }

      const result = await parseCSV(contentToParse);
      setData(result.data);
      setMeta(result.meta);
      setCustomAnnotations([]); // clear old custom annotations
    } catch (error) {
      alert('데이터 파싱 에러: ' + (error instanceof Error ? error.message : '알 수 없는 형식입니다.'));
    }
  }, []);

  const [isDragging, setIsDragging] = useState(false);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.xlsx'))) {
      handleFileUpload(file);
    } else {
      alert('.csv 또는 .xlsx 형식의 데이터 파일만 드롭할 수 있습니다.');
    }
  }, [handleFileUpload]);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  // Dynamic analysis computation based on custom thresholds state!
  const analysisResult = useMemo(() => {
    return analyzeReflowProfile(data, solderType, parsedThresholds);
  }, [data, solderType, parsedThresholds]);

  // Click point to add custom annotation
  const handleAddAnnotation = useCallback((x: number, y: number) => {
    const note = prompt(`[주석 추가] 시간: ${x.toFixed(0)}초, 온도: ${y.toFixed(1)}°C\n여기에 표시할 메모를 입력해주세요:`);
    if (note && note.trim() !== '') {
      setCustomAnnotations(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          x: Math.round(x),
          y: parseFloat(y.toFixed(1)),
          text: note.trim()
        }
      ]);
    }
  }, []);

  // Manual annotation submission
  const handleManualAddAnnotation = (e: React.FormEvent) => {
    e.preventDefault();
    const x = parseFloat(manualAnnX);
    const y = parseFloat(manualAnnY);
    if (isNaN(x) || isNaN(y) || !manualAnnText.trim()) {
      alert('올바른 시간(초), 온도(°C), 메모 내용을 기입하세요.');
      return;
    }
    setCustomAnnotations(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        x: Math.round(x),
        y: parseFloat(y.toFixed(1)),
        text: manualAnnText.trim()
      }
    ]);
    setManualAnnX('');
    setManualAnnY('');
    setManualAnnText('');
  };

  const handleDeleteAnnotation = (id: string) => {
    setCustomAnnotations(prev => prev.filter(ann => ann.id !== id));
  };

  // Fetch CSV files from env directory on mount
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getCsvFiles().then(res => {
        if (res.files) {
          setCsvFileList(res.files);
        } else if (res.error) {
          console.error('Failed to load CSV files:', res.error);
        }
      });
    }
  }, []);

  const handleSelectDirectory = async () => {
    if (!window.electronAPI) return;
    try {
      const res = await window.electronAPI.selectCsvDirectory();
      if (res.canceled) return;
      if (res.error) {
        alert('디렉터리 읽기 오류: ' + res.error);
        return;
      }
      if (res.files && res.dirPath) {
        setCurrentDirPath(res.dirPath);
        setCsvFileList(res.files);
      }
    } catch (error) {
      alert('오류 발생: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
    }
  };

  // Handle clicking a file from the list
  const handleFileItemClick = async (path: string) => {
    if (!window.electronAPI) return;
    try {
      const res = await window.electronAPI.readCsvFile(path);
      if (res.error) {
        alert('파일 읽기 오류: ' + res.error);
        return;
      }
      if (res.content) {
        const result = await parseCSV(res.content);
        setData(result.data);
        setMeta(result.meta);
        setCustomAnnotations([]);
      }
    } catch (error) {
      alert('CSV 파싱 에러: ' + (error instanceof Error ? error.message : '알 수 없는 형식입니다.'));
    }
  };

  // Export Highcharts as local PNG or JPEG
  const handleExport = (format: 'image/png' | 'image/jpeg') => {
    const activeChart = Highcharts.charts.find(c => c !== undefined);
    if (activeChart) {
      (activeChart as any).exportChart({
        type: format,
        filename: `Reflow_Profile_${solderComposition}_${meta?.serialNumber || 'data'}`
      }, {
        chart: {
          backgroundColor: '#ffffff' // Crisp light background for report inserts!
        },
        title: {
          style: { color: '#000000', fontWeight: 'bold' }
        },
        subtitle: {
          style: { color: '#333333' }
        },
        xAxis: {
          gridLineColor: 'rgba(0, 0, 0, 0.08)',
          labels: { style: { color: '#333333' } },
          title: { style: { color: '#333333' } }
        },
        yAxis: {
          gridLineColor: 'rgba(0, 0, 0, 0.08)',
          labels: { style: { color: '#333333' } },
          title: { style: { color: '#333333' } }
        }
      });
    } else {
      alert("차트를 찾을 수 없습니다.");
    }
  };

  // Print PDF report triggering
  const handlePrint = async () => {
    // 1. Prepare print styles dynamically to bypass media query limitations of html2canvas
    let printStyles = '';
    try {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule.constructor.name === 'CSSMediaRule' && (rule as CSSMediaRule).conditionText === 'print') {
              for (const mediaRule of Array.from((rule as CSSMediaRule).cssRules)) {
                printStyles += mediaRule.cssText + '\n';
              }
            }
          }
        } catch(e) {}
      }
    } catch (e) {
      console.warn("Could not read stylesheets for print export", e);
    }
    
    const styleEl = document.createElement("style");
    styleEl.id = "temp-print-styles";
    styleEl.innerHTML = printStyles;
    // Also explicitly force hide sidebars and controls
    styleEl.innerHTML += `
      header, .screen-only, .left-sidebar, .right-sidebar, .controls, button { display: none !important; }
      .center-panel { width: 100% !important; max-width: 100% !important; background: #fff !important; }
      .graph-section { width: 100% !important; max-width: 100% !important; background: #fff !important; }
    `;
    document.head.appendChild(styleEl);

    // 2. Adjust chart colors for light mode
    const activeChart = Highcharts.charts.find(c => c !== undefined);
    if (activeChart) {
      activeChart.update({
        chart: { backgroundColor: '#ffffff' },
        title: { style: { color: '#000000', fontWeight: 'bold' } },
        subtitle: { style: { color: '#333333' } },
        xAxis: {
          gridLineColor: 'rgba(0, 0, 0, 0.08)',
          labels: { style: { color: '#333333' } },
          title: { style: { color: '#333333' } }
        },
        yAxis: {
          gridLineColor: 'rgba(0, 0, 0, 0.08)',
          labels: { style: { color: '#333333' } },
          title: { style: { color: '#333333' } }
        }
      }, true);
    }

    // 3. Wait for render
    await new Promise(resolve => setTimeout(resolve, 800));

    // 4. Capture and Export
    const element = document.querySelector('.workspace-console') as HTMLElement;
    if (element) {
      const origWidth = element.style.width;
      element.style.width = '1200px'; // Fixed width for A4 landscape ratio
      
      try {
        const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png');
        
        const pdf = new jsPDF('l', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Reflow_Report_${meta?.serialNumber || 'Data'}.pdf`);
      } catch (err) {
        console.error("PDF Export Error: ", err);
        alert("PDF 생성 중 오류가 발생했습니다.");
      } finally {
        element.style.width = origWidth;
      }
    }

    // 5. Cleanup
    document.head.removeChild(styleEl);
    if (activeChart) {
      activeChart.update({
        chart: { backgroundColor: '#16161a' },
        title: { style: { color: '#ffffff', fontWeight: 'bold' } },
        subtitle: { style: { color: '#9ca3af' } },
        xAxis: {
          gridLineColor: 'rgba(255, 255, 255, 0.04)',
          labels: { style: { color: '#9ca3af' } },
          title: { style: { color: '#9ca3af' } }
        },
        yAxis: {
          gridLineColor: 'rgba(255, 255, 255, 0.04)',
          labels: { style: { color: '#9ca3af' } },
          title: { style: { color: '#9ca3af' } }
        }
      }, true);
    }
  };

  // Dynamic print listeners to toggle Highcharts colors automatically for ink saving
  useEffect(() => {
    const handleBeforePrint = () => {
      const activeChart = Highcharts.charts.find(c => c !== undefined);
      if (activeChart) {
        activeChart.update({
          chart: { backgroundColor: '#ffffff' },
          title: { style: { color: '#000000', fontWeight: 'bold' } },
          subtitle: { style: { color: '#333333' } },
          xAxis: {
            gridLineColor: 'rgba(0, 0, 0, 0.08)',
            labels: { style: { color: '#333333' } },
            title: { style: { color: '#333333' } }
          },
          yAxis: {
            gridLineColor: 'rgba(0, 0, 0, 0.08)',
            labels: { style: { color: '#333333' } },
            title: { style: { color: '#333333' } }
          }
        }, true);
      }
    };

    const handleAfterPrint = () => {
      const activeChart = Highcharts.charts.find(c => c !== undefined);
      if (activeChart) {
        activeChart.update({
          chart: { backgroundColor: '#16161a' },
          title: { style: { color: '#ffffff', fontWeight: 'bold' } },
          subtitle: { style: { color: '#9ca3af' } },
          xAxis: {
            gridLineColor: 'rgba(255, 255, 255, 0.04)',
            labels: { style: { color: '#9ca3af' } },
            title: { style: { color: '#9ca3af' } }
          },
          yAxis: {
            gridLineColor: 'rgba(255, 255, 255, 0.04)',
            labels: { style: { color: '#9ca3af' } },
            title: { style: { color: '#9ca3af' } }
          }
        }, true);
      }
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [solderComposition, meta]);

  return (
    <>
      {/* 1. Header (Screen Only) */}
      <header className="screen-only">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Thermometer size={22} color="#3b82f6" />
            <span>Reflow Profile Console <span style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 'normal' }}>v2.0</span></span>
          </div>
        </div>
        <div className="controls">
          <button onClick={() => document.getElementById('fileInput')?.click()}>
            <Upload size={14} style={{ marginRight: 6 }} />
            Open CSV
          </button>
          <button onClick={loadDemoData} style={{ backgroundColor: '#24242b' }}>
            <FileText size={14} style={{ marginRight: 6 }} />
            Load Sample
          </button>
          <input 
            id="fileInput" 
            type="file" 
            accept=".csv" 
            style={{ display: 'none' }} 
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
          />
          {data.length > 0 && (
            <button onClick={handlePrint} className="primary">
              <Printer size={14} style={{ marginRight: 6 }} />
              PDF Report Print
            </button>
          )}
        </div>
      </header>

      {/* 2. Main Application Area */}
      <main onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}>
        
        {/* Drag & Drop Overlay */}
        <div className={`drop-zone ${isDragging ? 'active' : ''}`}>
          <Upload size={48} color="#3b82f6" />
          <p>여기에 온도 데이터 파일(.csv, .xlsx)을 드롭하세요</p>
        </div>

        <div className="workspace-console" style={{ gridTemplateColumns: data.length > 0 ? '310px 1fr 360px' : '310px 1fr' }}>
          
          {/* COLUMN 1: LEFT SIDEBAR (Controls & Form - Screen Only) */}
          <div className="left-sidebar screen-only">
              
              <div className="sidebar-tabs">
                <button 
                  className={`tab-btn ${activeLeftTab === 'settings' ? 'active' : ''}`}
                  onClick={() => setActiveLeftTab('settings')}
                >
                  환경 설정
                </button>
                <button 
                  className={`tab-btn ${activeLeftTab === 'files' ? 'active' : ''}`}
                  onClick={() => setActiveLeftTab('files')}
                >
                  파일 리스트
                </button>
              </div>

              {activeLeftTab === 'settings' ? (
                <>
                  {/* Preset Selector */}
                  <div className="panel-card">
                    <div className="panel-label">솔더 표준 규격 프리셋</div>
                    <div className="preset-grid">
                      <button 
                        className={`preset-btn ${solderType === 'pb-free' ? 'active' : ''}`}
                        onClick={() => handlePresetSelect('pb-free')}
                      >
                        Pb-Free 무연 (SAC305)
                      </button>
                      <button 
                        className={`preset-btn ${solderType === 'leaded' ? 'active' : ''}`}
                        onClick={() => handlePresetSelect('leaded')}
                      >
                        Leaded 유연 (Sn63)
                      </button>
                    </div>
                  </div>

                  {/* Solder / Conveyor Details */}
                  <div className="panel-card">
                    <div className="panel-label">공정 기본 정보</div>
                    <div className="form-group">
                      <label>솔더 화학 조성비 명칭</label>
                      <input 
                        type="text" 
                        value={solderComposition} 
                        onChange={(e) => setSolderComposition(e.target.value)}
                        placeholder="예: Sn 96.5 / Ag 3.0 / Cu 0.5"
                      />
                    </div>
                    <div className="form-group">
                      <label>컨베이어 이송 속도</label>
                      <input 
                        type="text" 
                        value={conveyorSpeed} 
                        onChange={(e) => setConveyorSpeed(e.target.value)}
                        placeholder="예: 1.2 mm/s"
                      />
                    </div>
                  </div>

                  {/* Reflow Chamber Zone Temperatures */}
                  <div className="panel-card">
                    <div className="panel-label">리플로우 챔버 설정 온도 (Zone Temps)</div>
                    {[1, 2, 3, 4].map(zoneNum => {
                      const topKey = `z${zoneNum}Top` as keyof ZoneTemperatures;
                      const botKey = `z${zoneNum}Bot` as keyof ZoneTemperatures;
                      const zoneName = zoneNum === 1 ? 'Preheat (예열)' : 
                                      zoneNum === 2 ? 'Soak (소크)' : 
                                      zoneNum === 3 ? 'Reflow (리플로우)' : 'Cooling (냉각)';
                      return (
                        <div key={zoneNum} style={{ marginBottom: '10px' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#3b82f6', marginBottom: '4px' }}>
                            Zone {zoneNum} - {zoneName}
                          </div>
                          <div className="form-row">
                            <div className="form-group">
                              <label>상부 (Top, °C)</label>
                              <input 
                                type="number" 
                                value={zoneTemps[topKey]} 
                                onChange={(e) => handleZoneTempChange(topKey, e.target.value)}
                              />
                            </div>
                            <div className="form-group">
                              <label>하부 (Bot, °C)</label>
                              <input 
                                type="number" 
                                value={zoneTemps[botKey]} 
                                onChange={(e) => handleZoneTempChange(botKey, e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Dynamic Parameter Overrides */}
                  <div className="panel-card">
                    <div className="panel-label">공정 구간 임계값 오버라이드</div>
                    
                    <div className="form-row">
                      <div className="form-group">
                        <label>Soak Start (°C)</label>
                        <input 
                          type="number" 
                          value={customThresholds.soakStartTemp} 
                          onChange={(e) => handleThresholdChange('soakStartTemp', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Soak End (°C)</label>
                        <input 
                          type="number" 
                          value={customThresholds.soakEndTemp} 
                          onChange={(e) => handleThresholdChange('soakEndTemp', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Liquidus Temp (°C)</label>
                      <input 
                        type="number" 
                        value={customThresholds.liquidusTemp} 
                        onChange={(e) => handleThresholdChange('liquidusTemp', e.target.value)}
                      />
                    </div>

                    <div className="panel-divider">Spec Range</div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Initial Ramp-up Min (°C/s)</label>
                        <input 
                          type="number" step="0.1"
                          value={customThresholds.rampUpMin} 
                          onChange={(e) => handleThresholdChange('rampUpMin', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Initial Ramp-up Max (°C/s)</label>
                        <input 
                          type="number" step="0.1"
                          value={customThresholds.rampUpMax} 
                          onChange={(e) => handleThresholdChange('rampUpMax', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Initial Ramp-up Time Min (s)</label>
                        <input 
                          type="number" 
                          value={customThresholds.rampUpTimeMin} 
                          onChange={(e) => handleThresholdChange('rampUpTimeMin', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Initial Ramp-up Time Max (s)</label>
                        <input 
                          type="number" 
                          value={customThresholds.rampUpTimeMax} 
                          onChange={(e) => handleThresholdChange('rampUpTimeMax', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Soak Duration Min (s)</label>
                        <input 
                          type="number" 
                          value={customThresholds.soakDurationMin} 
                          onChange={(e) => handleThresholdChange('soakDurationMin', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Soak Duration Max (s)</label>
                        <input 
                          type="number" 
                          value={customThresholds.soakDurationMax} 
                          onChange={(e) => handleThresholdChange('soakDurationMax', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Reflow Ramp-up Min (°C/s)</label>
                        <input 
                          type="number" step="0.1"
                          value={customThresholds.reflowRampUpMin} 
                          onChange={(e) => handleThresholdChange('reflowRampUpMin', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Reflow Ramp-up Max (°C/s)</label>
                        <input 
                          type="number" step="0.1"
                          value={customThresholds.reflowRampUpMax} 
                          onChange={(e) => handleThresholdChange('reflowRampUpMax', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>TAL Duration Min (s)</label>
                        <input 
                          type="number" 
                          value={customThresholds.talMin} 
                          onChange={(e) => handleThresholdChange('talMin', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>TAL Duration Max (s)</label>
                        <input 
                          type="number" 
                          value={customThresholds.talMax} 
                          onChange={(e) => handleThresholdChange('talMax', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Peak Temp Min (°C)</label>
                        <input 
                          type="number" 
                          value={customThresholds.peakTempMin} 
                          onChange={(e) => handleThresholdChange('peakTempMin', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Peak Temp Max (°C)</label>
                        <input 
                          type="number" 
                          value={customThresholds.peakTempMax} 
                          onChange={(e) => handleThresholdChange('peakTempMax', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Time at Peak Min (s)</label>
                        <input 
                          type="number" 
                          value={customThresholds.timeAtPeakMin} 
                          onChange={(e) => handleThresholdChange('timeAtPeakMin', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Time at Peak Max (s)</label>
                        <input 
                          type="number" 
                          value={customThresholds.timeAtPeakMax} 
                          onChange={(e) => handleThresholdChange('timeAtPeakMax', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Cooling Rate Min (°C/s)</label>
                        <input 
                          type="number" step="0.1"
                          value={customThresholds.coolingMin} 
                          onChange={(e) => handleThresholdChange('coolingMin', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Cooling Rate Max (°C/s)</label>
                        <input 
                          type="number" step="0.1"
                          value={customThresholds.coolingMax} 
                          onChange={(e) => handleThresholdChange('coolingMax', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Scale Mode */}
                  <div className="panel-card">
                    <div className="panel-label">차트 축 스케일 모드</div>
                    <div className="scale-switcher">
                      <button 
                        className={scaleMode === 'standard' ? 'active' : ''} 
                        onClick={() => setScaleMode('standard')}
                      >
                        Standard (0~480s / 300°C)
                      </button>
                      <button 
                        className={scaleMode === 'auto-fit' ? 'active' : ''} 
                        onClick={() => setScaleMode('auto-fit')}
                      >
                        Auto-Fit 동적 리사이즈
                      </button>
                    </div>
                  </div>

                  {/* Export Panel */}
                  <div className="panel-card">
                    <div className="panel-label">차트 이미지 고화질 내보내기</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <button onClick={() => handleExport('image/png')} className="icon-btn">
                        <Download size={13} style={{ marginRight: 4 }} />
                        PNG 저장
                      </button>
                      <button onClick={() => handleExport('image/jpeg')} className="icon-btn">
                        <Download size={13} style={{ marginRight: 4 }} />
                        JPEG 저장
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="panel-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div className="panel-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>데이터 파일 목록 (.csv, .xlsx)</span>
                    <button onClick={handleSelectDirectory} className="icon-btn" style={{ padding: '4px 8px', fontSize: '0.7rem', height: 'auto', backgroundColor: '#24242b', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <FolderOpen size={12} style={{ marginRight: 4 }} />
                      폴더 선택
                    </button>
                  </div>
                  {currentDirPath && (
                    <div style={{ fontSize: '0.65rem', color: '#9ca3af', marginBottom: '8px', wordBreak: 'break-all', backgroundColor: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '4px' }}>
                      경로: {currentDirPath}
                    </div>
                  )}
                  <div className="file-list-container" style={{ flex: 1, overflowY: 'auto' }}>
                    {csvFileList.length === 0 ? (
                      <div className="empty-annotations-alert">
                        데이터 파일이 없습니다.<br/>
                        상단의 <b>[폴더 선택]</b> 버튼을 눌러 데이터가 있는 디렉터리를 지정해주세요.
                      </div>
                    ) : (
                      csvFileList.map((file, idx) => (
                        <div 
                          key={idx} 
                          className="file-list-item"
                          onClick={() => handleFileItemClick(file.path)}
                        >
                          <FileSpreadsheet size={14} style={{ marginRight: '6px', color: '#3b82f6', flexShrink: 0 }} />
                          <span className="file-name" title={file.name}>{file.name}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {data.length > 0 ? (
              <>
                {/* COLUMN 2: CENTER PANEL (Chart & Header Details - Screen and Print) */}
                <div className="center-panel">
              
              {/* Printed Header Area (Print Only) */}
              <div className="print-report-header">
                <h1>REFLOW PROCESS ENGINEERING REPORT</h1>
                <span className="print-date">인쇄 일시: {new Date().toLocaleString()}</span>
              </div>

              {/* Metadata Details (Screen and Print) */}
              {meta && (
                <>
                  <div className="dataset-metadata-banner">
                    <div className="meta-card">
                      <span className="meta-lbl">장비 모델명</span>
                      <span className="meta-val">{meta.deviceName}</span>
                    </div>
                    <div className="meta-card">
                      <span className="meta-lbl">일련 번호</span>
                      <span className="meta-val">{meta.serialNumber}</span>
                    </div>
                    <div className="meta-card">
                      <span className="meta-lbl">기기 고유 ID</span>
                      <span className="meta-val">{meta.deviceId}</span>
                    </div>
                    <div className="meta-card screen-only">
                      <span className="meta-lbl">데이터 크기</span>
                      <span className="meta-val">{data.length} 포인트</span>
                    </div>
                    <div className="meta-card">
                      <span className="meta-lbl">주 열전쌍 분석 채널</span>
                      <span className="meta-val">열전지 2 (TC2)</span>
                    </div>
                  </div>

                  {/* Oven Zone Temperatures Quick View (Screen Only) */}
                  <div className="dataset-metadata-banner screen-only" style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                    {[1, 2, 3, 4].map(z => {
                      const top = parsedZoneTemps[`z${z}Top` as keyof ZoneTemperatures];
                      const bot = parsedZoneTemps[`z${z}Bot` as keyof ZoneTemperatures];
                      const zoneName = z === 1 ? 'Preheat' : 
                                       z === 2 ? 'Soak' : 
                                       z === 3 ? 'Reflow' : 'Cooling';
                      return (
                        <div key={z} className="meta-card" style={{ borderLeft: '3px solid #3b82f6', paddingLeft: '8px' }}>
                           <span className="meta-lbl" style={{ color: '#3b82f6', fontWeight: 700 }}>Zone {z} ({zoneName})</span>
                           <span className="meta-val" style={{ fontSize: '0.78rem' }}>
                             상부 {isNaN(top) ? '-' : top}°C / 하부 {isNaN(bot) ? '-' : bot}°C
                           </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Printable Metadata Grid (Print Only) */}
              {meta && (
                <div className="print-metadata-grid">
                  <div className="print-meta-col">
                    <p><b>기기 모델명:</b> {meta.deviceName}</p>
                    <p><b>기기 설명:</b> {meta.deviceDescription || 'N/A'}</p>
                    <p><b>일련 번호:</b> {meta.serialNumber}</p>
                    <p><b>기기 고유 ID:</b> {meta.deviceId}</p>
                  </div>
                  <div className="print-meta-col">
                    <p><b>솔더 성분/화학 조성비:</b> {solderComposition}</p>
                    <p><b>벨트 이동 속도:</b> {conveyorSpeed}</p>
                    <p><b>검증 솔더 규격:</b> {solderType === 'pb-free' ? 'Pb-Free (SAC305 무연)' : 'Leaded (Sn63/Pb37 유연)'}</p>
                    <p><b>주 분석 대상 채널:</b> 열전쌍 2 (TC2)</p>
                  </div>
                  <div className="print-meta-col" style={{ borderLeft: '1px solid #d1d5db', paddingLeft: '15px' }}>
                    <p><b>[리플로우 챔버 설정 온도]</b></p>
                    <p><b>Zone 1 (Preheat):</b> 상부 {isNaN(parsedZoneTemps.z1Top) ? '-' : parsedZoneTemps.z1Top}°C / 하부 {isNaN(parsedZoneTemps.z1Bot) ? '-' : parsedZoneTemps.z1Bot}°C</p>
                    <p><b>Zone 2 (Soak):</b> 상부 {isNaN(parsedZoneTemps.z2Top) ? '-' : parsedZoneTemps.z2Top}°C / 하부 {isNaN(parsedZoneTemps.z2Bot) ? '-' : parsedZoneTemps.z2Bot}°C</p>
                    <p><b>Zone 3 (Reflow):</b> 상부 {isNaN(parsedZoneTemps.z3Top) ? '-' : parsedZoneTemps.z3Top}°C / 하부 {isNaN(parsedZoneTemps.z3Bot) ? '-' : parsedZoneTemps.z3Bot}°C</p>
                    <p><b>Zone 4 (Cooling):</b> 상부 {isNaN(parsedZoneTemps.z4Top) ? '-' : parsedZoneTemps.z4Top}°C / 하부 {isNaN(parsedZoneTemps.z4Bot) ? '-' : parsedZoneTemps.z4Bot}°C</p>
                  </div>
                </div>
              )}

              {/* Interactive Highcharts Component */}
              <div className="graph-section">
                <ReflowChart 
                  data={data} 
                  solderType={solderType} 
                  customThresholds={parsedThresholds}
                  scaleMode={scaleMode}
                  solderComposition={solderComposition}
                  conveyorSpeed={conveyorSpeed}
                  customAnnotations={customAnnotations}
                  onAddAnnotation={handleAddAnnotation}
                />
              </div>

              {/* Printable 5-Metric Analysis Table (Print Only) */}
              {analysisResult && (
                <div className="print-table-container">
                  <h3>5대 핵심 공정 구간 물리량 연산 테이블</h3>
                  <table className="print-table">
                    <thead>
                      <tr>
                        <th>공정 지표</th>
                        <th>실측 연산값</th>
                        <th>합격 스펙 (Spec Range)</th>
                        <th>판정 결과</th>
                        <th>상태 진단 및 도메인 처방</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        analysisResult.rampUp,
                        analysisResult.soakDuration,
                        analysisResult.reflowRampUp,
                        analysisResult.tal,
                        analysisResult.peakTemp,
                        analysisResult.cooling
                      ].map((m, idx) => (
                        <tr key={idx}>
                          <td><b>{m.name.split(' (')[0]}</b></td>
                          <td style={{ fontWeight: 'bold' }}>
                            {m.value !== null ? `${m.value >= 0 ? '' : '-'}${Math.abs(m.value).toFixed(2)} ${m.unit}` : 'N/A'}
                          </td>
                          <td>{m.minLimit} ~ {m.maxLimit} {m.unit}</td>
                          <td style={{ fontWeight: 'bold', color: m.status === 'PASS' ? '#059669' : m.status === 'WARNING' ? '#d97706' : '#dc2626' }}>
                            {m.status}
                          </td>
                          <td style={{ fontSize: '0.8rem', lineHeight: '1.3' }}>{m.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {/* Signature Section for Print */}
                  <div className="print-signature-section">
                    <div className="signature-box">
                      <p>공정 담당 엔지니어 서명: ________________________</p>
                    </div>
                    <div className="signature-box">
                      <p>라인 관리 및 승인 책임자 서명: ________________________</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* COLUMN 3: RIGHT INSIGHT SIDEBAR (Scorecard, Warnings, Custom Notes - Screen Only) */}
            <div className="right-sidebar screen-only">
              
              {/* Overall Status Card */}
              {analysisResult && (
                <div className={`overall-status-card status-${analysisResult.overallStatus.toLowerCase()}`}>
                  <div className="status-header">
                    <span className="status-badge">
                      {analysisResult.overallStatus}
                    </span>
                    <span className="solder-indicator">
                      {solderType === 'pb-free' ? 'SAC305 무연 규격' : 'Sn63/Pb37 유연 규격'}
                    </span>
                  </div>
                  <h2 className="status-title">
                    {analysisResult.overallStatus === 'PASS' 
                      ? '온도 프로파일 검증 완료' 
                      : analysisResult.overallStatus === 'WARNING'
                      ? '주의 항목 관찰 필요'
                      : '공정 규격 이탈 (경고)'}
                  </h2>
                  <p className="status-desc">
                    {analysisResult.overallStatus === 'PASS'
                      ? '모든 5대 핵심 구간의 물리 지표가 설정한 관리 공정 스펙 한계 내에 안정적으로 정렬되어, 결합 수율과 솔더 신뢰성이 우수합니다.'
                      : analysisResult.overallStatus === 'WARNING'
                      ? '일부 구간 지표가 허용 스펙 경계선에 인접하여 가벼운 주의가 필요합니다. 미세한 공정 튜닝으로 수율 보강을 할 수 있습니다.'
                      : '일부 온도 파라미터가 적정 관리 영역을 크게 벗어났습니다. 아래 항목별 경고 메시지를 검토하여 챔버 히팅 밸런스 및 벨트 속도를 즉시 리트레이싱하십시오.'}
                  </p>
                </div>
              )}

              {/* 5-Metrics score list */}
              {analysisResult && (
                <div className="scorecard-list">
                  <div className="sidebar-subtitle">공정 구간 적합성 스코어</div>
                  {[
                    analysisResult.rampUp,
                    analysisResult.rampUpTime,
                    analysisResult.soakDuration,
                    analysisResult.reflowRampUp,
                    analysisResult.tal,
                    analysisResult.peakTemp,
                    analysisResult.timeAtPeak,
                    analysisResult.cooling
                  ].map((metric, idx) => (
                    <div key={idx} className={`metric-score-card border-${metric.status.toLowerCase()}`}>
                      <div className="metric-score-header">
                        <span className="metric-score-title">{metric.name}</span>
                        <span className={`status-pill pill-${metric.status.toLowerCase()}`}>
                          {metric.status === 'PASS' && <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><CheckCircle size={11} /> PASS</span>}
                          {metric.status === 'WARNING' && <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><AlertTriangle size={11} /> WARN</span>}
                          {metric.status === 'FAIL' && <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><XCircle size={11} /> FAIL</span>}
                        </span>
                      </div>
                      
                      <div className="metric-score-val-row">
                        <span className="metric-score-val">
                          {metric.value !== null 
                            ? `${metric.value >= 0 ? '' : '-'}${Math.abs(metric.value).toFixed(2)} ${metric.unit}` 
                            : 'N/A'}
                        </span>
                        <span className="metric-score-target">
                          Spec: {metric.minLimit} ~ {metric.maxLimit} {metric.unit}
                        </span>
                      </div>

                      <p className="metric-score-desc">
                        <Info size={10} color="#9ca3af" style={{ flexShrink: 0, marginTop: 2 }} />
                        <span>{metric.description}</span>
                      </p>

                      <div className={`metric-score-msg msg-${metric.status.toLowerCase()}`}>
                        {metric.message}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Custom Annotations List Manager */}
              <div className="panel-card" style={{ marginTop: '8px' }}>
                <div className="sidebar-subtitle" style={{ paddingLeft: 0 }}>등록된 사용자 주석 (Annotations)</div>
                
                {customAnnotations.length === 0 ? (
                  <div className="empty-annotations-alert">
                    <p>차트 선 위의 개별 온도를 마우스로 직접 클릭하면 화면 상에 설명 풍선 주석을 즉시 추가할 수 있습니다.</p>
                  </div>
                ) : (
                  <div className="annotations-list">
                    {customAnnotations.map(ann => (
                      <div key={ann.id} className="annotation-item">
                        <div className="ann-body">
                          <span className="ann-coords">시간: {ann.x}초  |  온도: {ann.y}°C</span>
                          <span className="ann-text">{ann.text}</span>
                        </div>
                        <button 
                          onClick={() => handleDeleteAnnotation(ann.id)} 
                          className="ann-del-btn"
                          title="삭제"
                        >
                          <Trash2 size={12} color="#f43f5e" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Manual Add Annotation Form */}
                <form onSubmit={handleManualAddAnnotation} className="manual-ann-form">
                  <div className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', marginBottom: 6 }}>주석 좌표 수동 추가</div>
                  <div className="form-row">
                    <div className="form-group">
                      <input 
                        type="number" 
                        placeholder="시간 (초)" 
                        value={manualAnnX}
                        onChange={(e) => setManualAnnX(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <input 
                        type="number" step="0.1"
                        placeholder="온도 (°C)" 
                        value={manualAnnY}
                        onChange={(e) => setManualAnnY(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="form-row" style={{ marginTop: 6 }}>
                    <div className="form-group" style={{ flexGrow: 1 }}>
                      <input 
                        type="text" 
                        placeholder="주석 메모 기입" 
                        value={manualAnnText}
                        onChange={(e) => setManualAnnText(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="primary" style={{ padding: '0 12px', height: 32 }}>
                      <Plus size={14} />
                    </button>
                  </div>
                </form>
              </div>
              </div>

            </>
            ) : (
              /* Empty Workspace / Standard Load Screen */
              <div className="empty-workspace" style={{ flex: 1, backgroundColor: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <Upload size={54} color="#3b82f6" style={{ marginBottom: 16 }} />
                <h2>Semiconductor Reflow Profile Analyzer</h2>
                <p>
                  본 분석 도구는 SMT 반도체 패키징 공정 내 솔더 접합부 신뢰성 확보를 위해 5대 핵심 구간의 물리적 지표
                  (승온/냉각 속도, 예열 유지 시간, TAL, 최고 온도)를 실시간 연산하고 안전 한계를 검증합니다.
                  온도 로그 데이터 파일(.csv, .xlsx)을 업로드하거나 샘플 데모 데이터를 로드하여 분석을 시작하십시오.
                </p>
                <div className="empty-buttons">
                  <button className="primary" onClick={() => document.getElementById('fileInput')?.click()}>
                    <Upload size={14} style={{ marginRight: 6 }} />
                    데이터 파일 불러오기
                  </button>
                  <button onClick={loadDemoData}>
                    <FileSpreadsheet size={14} style={{ marginRight: 6 }} />
                    샘플 데모 데이터 로드
                  </button>
                </div>
              </div>
            )}
          </div>
      </main>
    </>
  );
};

export default App;
