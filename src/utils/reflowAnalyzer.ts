import type { ReflowDataPoint } from './csvParser';

export type SolderType = 'pb-free' | 'leaded';

export interface MetricEvaluation {
  name: string;
  value: number | null;
  unit: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  minLimit: number;
  maxLimit: number;
  description: string;
  message: string;
}

export interface ReflowAnalysisResult {
  solderType: SolderType;
  rampUp: MetricEvaluation;
  soakDuration: MetricEvaluation;
  reflowRampUp: MetricEvaluation;
  tal: MetricEvaluation;
  peakTemp: MetricEvaluation;
  cooling: MetricEvaluation;
  overallStatus: 'PASS' | 'FAIL' | 'WARNING';
}

export interface SolderThresholds {
  soakStartTemp: number;
  soakEndTemp: number;
  liquidusTemp: number;
  rampUpMin: number;
  rampUpMax: number;
  soakDurationMin: number;
  soakDurationMax: number;
  reflowRampUpMin: number;
  reflowRampUpMax: number;
  talMin: number;
  talMax: number;
  peakTempMin: number;
  peakTempMax: number;
  coolingMin: number; // e.g. -4.0
  coolingMax: number; // e.g. -1.0
}

export const THRESHOLDS: Record<SolderType, SolderThresholds> = {
  'pb-free': {
    soakStartTemp: 150,
    soakEndTemp: 200,
    liquidusTemp: 217,
    rampUpMin: 1.0,
    rampUpMax: 3.0,
    soakDurationMin: 60,
    soakDurationMax: 120,
    reflowRampUpMin: 1.0,
    reflowRampUpMax: 2.0,
    talMin: 45,
    talMax: 90,
    peakTempMin: 235,
    peakTempMax: 250,
    coolingMin: -4.0,
    coolingMax: -1.0,
  },
  'leaded': {
    soakStartTemp: 100,
    soakEndTemp: 150,
    liquidusTemp: 183,
    rampUpMin: 1.0,
    rampUpMax: 3.0,
    soakDurationMin: 60,
    soakDurationMax: 120,
    reflowRampUpMin: 1.0,
    reflowRampUpMax: 2.0,
    talMin: 60,
    talMax: 90,
    peakTempMin: 210,
    peakTempMax: 230,
    coolingMin: -4.0,
    coolingMax: -1.0,
  },
};

export const analyzeReflowProfile = (
  data: ReflowDataPoint[],
  solderType: SolderType = 'pb-free'
): ReflowAnalysisResult | null => {
  if (data.length === 0) return null;

  // We analyze temp2 as required by the PRD
  const points = data.filter(d => !isNaN(d.temp2));
  if (points.length === 0) return null;

  const thresholds = THRESHOLDS[solderType];

  // 1. Initial Ramp-Up Rate (Ambient to Soak Start Temp)
  const pStart = points[0];
  const pSoakStart = points.find(d => d.temp2 >= thresholds.soakStartTemp);
  let rampUpRate: number | null = null;
  let rampUpStatus: 'PASS' | 'FAIL' | 'WARNING' = 'FAIL';
  let rampUpMsg = '데이터 부족으로 계산 불가';

  if (pSoakStart && pSoakStart.time > pStart.time) {
    rampUpRate = (pSoakStart.temp2 - pStart.temp2) / (pSoakStart.time - pStart.time);
    if (rampUpRate >= thresholds.rampUpMin && rampUpRate <= thresholds.rampUpMax) {
      rampUpStatus = 'PASS';
      rampUpMsg = '적정 승온 속도 유지 중';
    } else if (rampUpRate > thresholds.rampUpMax) {
      rampUpStatus = 'FAIL';
      rampUpMsg = '과도한 승온! 급격한 열팽창 차이로 열 충격 균열(Thermal Shock Crack) 또는 솔더 볼(Solder Balling) 발생 위험.';
    } else {
      rampUpStatus = 'WARNING';
      rampUpMsg = '승온 속도가 너무 느려 생산성이 저하되거나 플럭스가 조기 활성화될 수 있습니다.';
    }
  }

  // 2. Preheat / Soak Duration (Soak Start Temp to Soak End Temp)
  const pSoakEnd = points.find(d => d.temp2 >= thresholds.soakEndTemp);
  let soakDur: number | null = null;
  let soakStatus: 'PASS' | 'FAIL' | 'WARNING' = 'FAIL';
  let soakMsg = '예열 종료 온도에 도달하지 못함';

  if (pSoakStart && pSoakEnd && pSoakEnd.time > pSoakStart.time) {
    soakDur = pSoakEnd.time - pSoakStart.time;
    if (soakDur >= thresholds.soakDurationMin && soakDur <= thresholds.soakDurationMax) {
      soakStatus = 'PASS';
      soakMsg = '적정 예열 시간 유지 중 (플럭스 활성화 및 기판 온도 균일화 달성)';
    } else if (soakDur > thresholds.soakDurationMax) {
      soakStatus = 'FAIL';
      soakMsg = '과도한 예열 시간! 플럭스 조기 증발/연소(Flux Exhaustion)로 멜팅 불량 및 패드 산화 유발 위험.';
    } else {
      soakStatus = 'FAIL';
      soakMsg = '예열 시간 부족! 온도 불균일로 툼스톤(Tombstone) 현상 또는 기판 변형 위험.';
    }
  }

  // 5. Peak Temperature (Peak)
  const pPeak = points.reduce((prev, curr) => (prev.temp2 > curr.temp2 ? prev : curr));
  const peakT = pPeak.temp2;
  let peakStatus: 'PASS' | 'FAIL' | 'WARNING' = 'FAIL';
  let peakMsg = '최고 온도 도달 불가';

  if (peakT >= thresholds.peakTempMin && peakT <= thresholds.peakTempMax) {
    peakStatus = 'PASS';
    peakMsg = '최적 최고 온도 범위 도달 완료';
  } else if (peakT > thresholds.peakTempMax) {
    peakStatus = 'FAIL';
    peakMsg = `최고 온도 한계 초과! 부품 탄화, 패키지 박리(Delamination), 칩 영구 파괴 등 심각한 열손상 유발 위험. (최대 권장: ${thresholds.peakTempMax}°C)`;
  } else {
    peakStatus = 'FAIL';
    peakMsg = '최고 온도 미달! 솔더가 완전하게 융해되지 못해 접합력이 극도로 떨어집니다.';
  }

  // 3. Ramp-up to Peak Rate (Soak End Temp to Peak)
  let reflowRampUpRate: number | null = null;
  let reflowRampUpStatus: 'PASS' | 'FAIL' | 'WARNING' = 'FAIL';
  let reflowRampUpMsg = '피크 온도 도달 시간 분석 불가';

  if (pSoakEnd && pPeak.time > pSoakEnd.time) {
    reflowRampUpRate = (peakT - pSoakEnd.temp2) / (pPeak.time - pSoakEnd.time);
    if (reflowRampUpRate >= thresholds.reflowRampUpMin && reflowRampUpRate <= thresholds.reflowRampUpMax) {
      reflowRampUpStatus = 'PASS';
      reflowRampUpMsg = '리플로우 승온 속도 안정적';
    } else if (reflowRampUpRate > thresholds.reflowRampUpMax) {
      reflowRampUpStatus = 'WARNING';
      reflowRampUpMsg = '피크 도달 전 급격한 가열로 기판 및 부품의 뒤틀림/변형 위험.';
    } else {
      reflowRampUpStatus = 'WARNING';
      reflowRampUpMsg = '리플로우 승온 지연으로 인한 부품의 열 노출 시간 증가.';
    }
  }

  // 4. TAL (Time Above Liquidus)
  const pReflowIn = points.find(d => d.temp2 >= thresholds.liquidusTemp);
  const pReflowOut = [...points].reverse().find(d => d.temp2 >= thresholds.liquidusTemp);
  let talVal: number | null = null;
  let talStatus: 'PASS' | 'FAIL' | 'WARNING' = 'FAIL';
  let talMsg = '액상선 온도에 도달하지 못함';

  if (pReflowIn && pReflowOut && pReflowOut.time > pReflowIn.time) {
    talVal = pReflowOut.time - pReflowIn.time;
    if (talVal >= thresholds.talMin && talVal <= thresholds.talMax) {
      talStatus = 'PASS';
      talMsg = '적정 액상선 유지 시간 충족 (최적의 IMC 층 두께 형성)';
    } else if (talVal > thresholds.talMax) {
      talStatus = 'FAIL';
      talMsg = `너무 긴 TAL! IMC(금속간화합물) 층이 너무 두껍게 형성되어 취성(Brittle Joint) 상태가 되며 부품이 과열 손상됩니다.`;
    } else {
      talStatus = 'FAIL';
      talMsg = `너무 짧은 TAL! 계면에 화학적 접합이 이루어지지 않아 기계적 응력에 약한 냉납(Cold Joint) 또는 비젖음(Non-wetting) 발생.`;
    }
  }

  // 6. Cooling Rate (Peak to 100°C or end of dataset)
  const pointsAfterPeak = points.filter(d => d.time > pPeak.time);
  let pCoolEnd = pointsAfterPeak.find(d => d.temp2 <= 100);
  if (!pCoolEnd && pointsAfterPeak.length > 0) {
    pCoolEnd = pointsAfterPeak[pointsAfterPeak.length - 1]; // Use last point
  }

  let coolingRate: number | null = null;
  let coolingStatus: 'PASS' | 'FAIL' | 'WARNING' = 'FAIL';
  let coolingMsg = '냉각 단계 데이터 부족';

  if (pCoolEnd && pCoolEnd.time > pPeak.time) {
    coolingRate = (pCoolEnd.temp2 - peakT) / (pCoolEnd.time - pPeak.time); // Neg value
    const absCooling = Math.abs(coolingRate);
    const absMin = Math.abs(thresholds.coolingMax); // 1.0
    const absMax = Math.abs(thresholds.coolingMin); // 4.0

    if (absCooling >= absMin && absCooling <= absMax) {
      coolingStatus = 'PASS';
      coolingMsg = '최적의 냉각 속도로 미세한 결정립 구조 및 조인트 강도 확보';
    } else if (absCooling > absMax) {
      coolingStatus = 'FAIL';
      coolingMsg = `급속 냉각! 기판(FR4)과 세라믹 소자의 열수축 편차로 솔더 조인트에 크랙이 가거나 부품이 파손될 수 있습니다.`;
    } else {
      coolingStatus = 'FAIL';
      coolingMsg = '완만 냉각! 냉각이 너무 느려 솔더 주석 결정이 조대화(Grain Coarsening)되어 기계적 수명이 짧아집니다.';
    }
  }

  // Calculate Overall Status
  const statuses = [rampUpStatus, soakStatus, reflowRampUpStatus, talStatus, peakStatus, coolingStatus];
  let overallStatus: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';
  if (statuses.includes('FAIL')) {
    overallStatus = 'FAIL';
  } else if (statuses.includes('WARNING')) {
    overallStatus = 'WARNING';
  }

  return {
    solderType,
    rampUp: {
      name: 'Initial Ramp-up Rate',
      value: rampUpRate,
      unit: '°C/s',
      status: rampUpStatus,
      minLimit: thresholds.rampUpMin,
      maxLimit: thresholds.rampUpMax,
      description: `상온(25°C)에서 예열 시작(${thresholds.soakStartTemp}°C)까지 상승 속도`,
      message: rampUpMsg,
    },
    soakDuration: {
      name: 'Preheat / Soak Time',
      value: soakDur,
      unit: 's',
      status: soakStatus,
      minLimit: thresholds.soakDurationMin,
      maxLimit: thresholds.soakDurationMax,
      description: `${thresholds.soakStartTemp}°C에서 ${thresholds.soakEndTemp}°C까지 예열 유지 시간`,
      message: soakMsg,
    },
    reflowRampUp: {
      name: 'Reflow Ramp-up Rate (Peak Ramp-up)',
      value: reflowRampUpRate,
      unit: '°C/s',
      status: reflowRampUpStatus,
      minLimit: thresholds.reflowRampUpMin,
      maxLimit: thresholds.reflowRampUpMax,
      description: `예열 종료(${thresholds.soakEndTemp}°C)에서 최고 온도(Peak)까지 승온 속도`,
      message: reflowRampUpMsg,
    },
    tal: {
      name: 'Time Above Liquidus (TAL)',
      value: talVal,
      unit: 's',
      status: talStatus,
      minLimit: thresholds.talMin,
      maxLimit: thresholds.talMax,
      description: `액상선 온도(${thresholds.liquidusTemp}°C) 이상 유지 시간`,
      message: talMsg,
    },
    peakTemp: {
      name: 'Peak Temperature',
      value: peakT,
      unit: '°C',
      status: peakStatus,
      minLimit: thresholds.peakTempMin,
      maxLimit: thresholds.peakTempMax,
      description: '프로파일 최고점 측정 온도',
      message: peakMsg,
    },
    cooling: {
      name: 'Cooling Rate',
      value: coolingRate,
      unit: '°C/s',
      status: coolingStatus,
      minLimit: thresholds.coolingMin,
      maxLimit: thresholds.coolingMax,
      description: '최고 온도(Peak)에서 냉각 목표 온도까지의 하강 기울기',
      message: coolingMsg,
    },
    overallStatus,
  };
};
