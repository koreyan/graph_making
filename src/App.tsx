import React, { useState, useCallback, useMemo } from 'react';
import { 
  Upload, 
  FileText, 
  Download, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Info,
  Thermometer,
  Menu,
  X
} from 'lucide-react';
import Highcharts from 'highcharts/highstock';
import AnnotationsModule from 'highcharts/modules/annotations';
import ExportingModule from 'highcharts/modules/exporting';
import OfflineExportingModule from 'highcharts/modules/offline-exporting';
import { parseCSV } from './utils/csvParser';
import type { ReflowDataPoint, ReflowMetaData } from './utils/csvParser';
import { generateMockReflowData } from './utils/mockData';
import { analyzeReflowProfile } from './utils/reflowAnalyzer';
import type { SolderType } from './utils/reflowAnalyzer';
import ReflowChart from './components/ReflowChart';
import './index.css';

// Initialize modules
if (typeof AnnotationsModule === 'function') {
  (AnnotationsModule as any)(Highcharts);
}
if (typeof ExportingModule === 'function') {
  (ExportingModule as any)(Highcharts);
}
if (typeof OfflineExportingModule === 'function') {
  (OfflineExportingModule as any)(Highcharts);
}

const App: React.FC = () => {
  const [data, setData] = useState<ReflowDataPoint[]>([]);
  const [meta, setMeta] = useState<ReflowMetaData | null>(null);
  const [solderType, setSolderType] = useState<SolderType>('pb-free');
  const [isDragging, setIsDragging] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const loadDemoData = () => {
    const mockData = generateMockReflowData();
    setData(mockData);
    setMeta({
      deviceName: 'Demo Reflow Oven A-4',
      serialNumber: 'SN-REFLOW-9982',
      channels: ['TC1', 'TC2', 'TC3', 'TC4']
    });
    setIsSidebarOpen(true); // Auto-open analysis panel on load
  };

  const handleFileUpload = useCallback(async (file: File) => {
    try {
      const result = await parseCSV(file);
      setData(result.data);
      setMeta(result.meta);
      setIsSidebarOpen(true); // Auto-open analysis panel on upload
    } catch (error) {
      alert('CSV Parsing Error: ' + (error instanceof Error ? error.message : 'Unknown format.'));
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      handleFileUpload(file);
    } else {
      alert('Only .csv files can be uploaded.');
    }
  }, [handleFileUpload]);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const analysisResult = useMemo(() => {
    return analyzeReflowProfile(data, solderType);
  }, [data, solderType]);

  const exportPDF = () => {
    const activeChart = Highcharts.charts.find(c => c !== undefined);
    if (activeChart) {
      (activeChart as any).exportChart({
        type: 'application/pdf',
        filename: `Reflow_Chart_${solderType}_${meta?.serialNumber || 'data'}`
      }, {
        chart: {
          backgroundColor: '#1e1e1e' // Keep professional dark theme in PDF
        }
      });
    } else {
      alert("Chart not found.");
    }
  };

  return (
    <>
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {data.length > 0 && (
            <button 
              className="hamburger-btn" 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              title="Toggle Analysis Panel"
            >
              <Menu size={16} />
            </button>
          )}
          <div className="title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Thermometer size={20} color="#3b82f6" />
            <span>Reflow Temperature Profile Analyzer</span>
          </div>
        </div>
        <div className="controls">
          <button onClick={() => document.getElementById('fileInput')?.click()}>
            <Upload size={14} style={{ marginRight: 6 }} />
            Open CSV
          </button>
          <button onClick={loadDemoData} style={{ backgroundColor: '#2d2d2d' }}>
            <FileText size={14} style={{ marginRight: 6 }} />
            Load Demo Data
          </button>
          <input 
            id="fileInput" 
            type="file" 
            accept=".csv" 
            style={{ display: 'none' }} 
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
          />
          {data.length > 0 && (
            <button onClick={exportPDF} className="primary">
              <Download size={14} style={{ marginRight: 6 }} />
              Save as PDF
            </button>
          )}
        </div>
      </header>

      <main onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}>
        <div className={`drop-zone ${isDragging ? 'active' : ''}`}>
          <Upload size={48} color="#3b82f6" />
          <p>Drop your Reflow CSV data here</p>
        </div>

        {data.length > 0 ? (
          <div className="workspace">
            {/* Sidebar Backdrop Overlay */}
            <div 
              className={`sidebar-backdrop ${isSidebarOpen ? 'open' : ''}`} 
              onClick={() => setIsSidebarOpen(false)} 
            />

            {/* Sidebar Drawer Panel - Slides Left to Right */}
            <div className={`sidebar-drawer ${isSidebarOpen ? 'open' : ''}`}>
              <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="sidebar-title">Analysis Summary</span>
                <button 
                  onClick={() => setIsSidebarOpen(false)} 
                  className="close-btn"
                  style={{ border: 'none', background: 'transparent', padding: '4px' }}
                >
                  <X size={18} color="#9ca3af" />
                </button>
              </div>
              
              <div className="analysis-section">
                {/* Overall Status Card */}
                {analysisResult && (
                  <div className={`overall-status-card status-${analysisResult.overallStatus.toLowerCase()}`}>
                    <div className="status-header">
                      <span className="status-badge">
                        {analysisResult.overallStatus === 'PASS' ? 'PASS' : analysisResult.overallStatus === 'WARNING' ? 'WARNING' : 'FAIL'}
                      </span>
                      <span className="solder-indicator">
                        {solderType === 'pb-free' ? 'SAC305 Pb-Free Spec' : 'Sn63/Pb37 Leaded Spec'}
                      </span>
                    </div>
                    <h2 className="status-title">
                      {analysisResult.overallStatus === 'PASS' 
                        ? '온도 프로파일 검증 완료' 
                        : analysisResult.overallStatus === 'WARNING'
                        ? '일부 지표 주의 관찰 필요'
                        : '공정 표준 미달 (불량 발생 위험)'}
                    </h2>
                    <p className="status-desc">
                      {analysisResult.overallStatus === 'PASS'
                        ? '모든 5대 핵심 구간의 승온 속도, 예열 유지 시간, TAL, 피크 온도 및 냉각 속도가 권장 공정 가이드라인 내에 안정적으로 분포되어 접합 신뢰성이 우수합니다.'
                        : analysisResult.overallStatus === 'WARNING'
                        ? '지표 일부가 허용 한계에 근접하거나 경미하게 어긋났습니다. 장기 신뢰성 향상을 위해 미세 조정을 고려할 수 있습니다.'
                        : '일부 온도 프로파일 지표가 관리 한계치를 크게 벗어났습니다. 아래 항목별 경고 메시지를 확인하고 오븐 온도 및 컨베이어 속도를 조절하십시오.'}
                    </p>
                  </div>
                )}

                {/* Solder Switcher */}
                <div className="card">
                  <div className="card-label">Solder Paste Selection</div>
                  <div className="solder-switcher">
                    <button 
                      className={solderType === 'pb-free' ? 'active' : ''} 
                      onClick={() => setSolderType('pb-free')}
                    >
                      Pb-Free (SAC305)
                    </button>
                    <button 
                      className={solderType === 'leaded' ? 'active' : ''} 
                      onClick={() => setSolderType('leaded')}
                    >
                      Leaded (Sn63/Pb37)
                    </button>
                  </div>
                </div>

                {/* Verification Metrics List */}
                {analysisResult && (
                  <div className="metrics-list">
                    {[
                      analysisResult.rampUp,
                      analysisResult.soakDuration,
                      analysisResult.reflowRampUp,
                      analysisResult.tal,
                      analysisResult.peakTemp,
                      analysisResult.cooling
                    ].map((metric, idx) => (
                      <div key={idx} className={`metric-card border-${metric.status.toLowerCase()}`}>
                        <div className="metric-header">
                          <span className="metric-title">{metric.name}</span>
                          <span className={`status-pill pill-${metric.status.toLowerCase()}`}>
                            {metric.status === 'PASS' && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={12} /> PASS</span>}
                            {metric.status === 'WARNING' && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12} /> WARN</span>}
                            {metric.status === 'FAIL' && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><XCircle size={12} /> FAIL</span>}
                          </span>
                        </div>
                        <div className="metric-value-row">
                          <span className="metric-val">
                            {metric.value !== null 
                              ? `${metric.value >= 0 ? '' : '-'}${Math.abs(metric.value).toFixed(2)} ${metric.unit}` 
                              : 'N/A'}
                          </span>
                          <span className="metric-target">
                            Spec: {metric.minLimit} ~ {metric.maxLimit} {metric.unit}
                          </span>
                        </div>
                        <p className="metric-description" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Info size={11} color="#6b7280" />
                          {metric.description}
                        </p>
                        {metric.message && (
                          <div className={`metric-message msg-${metric.status.toLowerCase()}`} style={{ marginTop: '8px' }}>
                            {metric.message}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Dataset Metadata Information */}
                {meta && (
                  <div className="card">
                    <div className="card-label">Dataset Metadata</div>
                    <div className="metadata-grid">
                      <div>
                        <span className="meta-lbl">Device Name</span>
                        <span className="meta-val">{meta.deviceName}</span>
                      </div>
                      <div>
                        <span className="meta-lbl">Serial Number</span>
                        <span className="meta-val">{meta.serialNumber}</span>
                      </div>
                      <div>
                        <span className="meta-lbl">Data Points</span>
                        <span className="meta-val">{data.length} pts</span>
                      </div>
                      <div>
                        <span className="meta-lbl">Target Channel</span>
                        <span className="meta-val">TC2</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Graph Canvas Section - Automatically Resizes to Full Screen when drawer is closed */}
            <div className="graph-section">
              <ReflowChart data={data} solderType={solderType} />
            </div>
          </div>
        ) : (
          <div className="empty-workspace">
            <Upload size={54} color="#3b82f6" style={{ marginBottom: 16 }} />
            <h2>Semiconductor Reflow Profile Analyzer</h2>
            <p>
              본 프로그램은 SMT 공정 내 솔더 접합부 신뢰성 확보를 위한 5대 핵심 구간의 물리적 지표(기울기, 유지 시간 등)를 
              자동 분석하고 검증합니다. 온도 로거에서 추출한 CSV 파일을 업로드하여 온도 적합 여부를 즉시 검사하십시오.
            </p>
            <div className="empty-buttons">
              <button className="primary" onClick={() => document.getElementById('fileInput')?.click()}>
                <Upload size={14} style={{ marginRight: 6 }} />
                Browse CSV File
              </button>
              <button onClick={loadDemoData}>
                <FileText size={14} style={{ marginRight: 6 }} />
                Load Sample Demo Data
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
};

export default App;
