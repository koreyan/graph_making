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
  rampUpTime: MetricEvaluation;
  soakDuration: MetricEvaluation;
  reflowRampUp: MetricEvaluation;
  tal: MetricEvaluation;
  peakTemp: MetricEvaluation;
  timeAtPeak: MetricEvaluation;
  cooling: MetricEvaluation;
  overallStatus: 'PASS' | 'FAIL' | 'WARNING';
}

export interface SolderThresholds {
  soakStartTemp: number;
  soakEndTemp: number;
  liquidusTemp: number;
  rampUpMin: number;
  rampUpMax: number;
  rampUpTimeMin: number;
  rampUpTimeMax: number;
  soakDurationMin: number;
  soakDurationMax: number;
  reflowRampUpMin: number;
  reflowRampUpMax: number;
  talMin: number;
  talMax: number;
  peakTempMin: number;
  peakTempMax: number;
  timeAtPeakMin: number;
  timeAtPeakMax: number;
  coolingMin: number; // e.g. -4.0 (fastest cooling limit)
  coolingMax: number; // e.g. -1.0 (slowest cooling limit)
}

export const THRESHOLDS: Record<SolderType, SolderThresholds> = {
  'pb-free': {
    soakStartTemp: 150,
    soakEndTemp: 200,
    liquidusTemp: 217,
    rampUpMin: 1.0,
    rampUpMax: 3.0,
    rampUpTimeMin: 40,
    rampUpTimeMax: 120,
    soakDurationMin: 60,
    soakDurationMax: 120,
    reflowRampUpMin: 1.0,
    reflowRampUpMax: 2.0,
    talMin: 45,
    talMax: 90,
    peakTempMin: 235,
    peakTempMax: 250,
    timeAtPeakMin: 15,
    timeAtPeakMax: 30,
    coolingMin: -4.0,
    coolingMax: -1.0,
  },
  'leaded': {
    soakStartTemp: 100,
    soakEndTemp: 150,
    liquidusTemp: 183,
    rampUpMin: 1.0,
    rampUpMax: 3.0,
    rampUpTimeMin: 40,
    rampUpTimeMax: 120,
    soakDurationMin: 60,
    soakDurationMax: 120,
    reflowRampUpMin: 1.0,
    reflowRampUpMax: 2.0,
    talMin: 60,
    talMax: 90,
    peakTempMin: 210,
    peakTempMax: 230,
    timeAtPeakMin: 15,
    timeAtPeakMax: 30,
    coolingMin: -4.0,
    coolingMax: -1.0,
  },
};

export const analyzeReflowProfile = (
  data: ReflowDataPoint[],
  solderType: SolderType = 'pb-free',
  customThresholds?: SolderThresholds
): ReflowAnalysisResult | null => {
  if (data.length === 0) return null;

  // We analyze temp2 (TC2) as required by the PRD
  const points = data.filter(d => !isNaN(d.temp2));
  if (points.length === 0) return null;

  // Use custom thresholds if provided, else fall back to preset
  // Normalize NaN values by falling back to the defaults of THRESHOLDS[solderType]
  const baseThresholds = THRESHOLDS[solderType];
  const thresholds: SolderThresholds = { ...baseThresholds };
  
  if (customThresholds) {
    for (const k in baseThresholds) {
      const key = k as keyof SolderThresholds;
      const customVal = customThresholds[key];
      thresholds[key] = (customVal === undefined || isNaN(customVal as number)) 
        ? (baseThresholds[key] as any) 
        : customVal;
    }
  }

  // 1. Initial Ramp-Up Rate and Time (Ambient to Soak Start Temp)
  const pStart = points[0];
  const pSoakStart = points.find(d => d.temp2 >= thresholds.soakStartTemp);
  let rampUpRate: number | null = null;
  let rampUpTimeVal: number | null = null;
  let rampUpStatus: 'PASS' | 'FAIL' | 'WARNING' = 'FAIL';
  let rampUpMsg = '데이터 부족';
  
  if (pSoakStart && pSoakStart.time > pStart.time) {
    rampUpTimeVal = pSoakStart.time - pStart.time;
    rampUpRate = (pSoakStart.temp2 - pStart.temp2) / rampUpTimeVal;
    
    if (rampUpRate >= thresholds.rampUpMin && rampUpRate <= thresholds.rampUpMax) {
      rampUpStatus = 'PASS';
      rampUpMsg = 'Initial ramp-up rate is within the optimal range.';
    } else if (rampUpRate > thresholds.rampUpMax) {
      rampUpStatus = 'FAIL';
      rampUpMsg = '⚠️ Excessive ramp-up! Rapid expansion may cause Thermal Shock Crack in components or Solder Balling due to violent flux boiling.';
    } else {
      rampUpStatus = 'WARNING';
      rampUpMsg = '⚠️ Insufficient ramp-up! Low productivity or early flux exhaustion risk.';
    }
  }

  let rampUpTimeStatus: 'PASS' | 'FAIL' | 'WARNING' = 'FAIL';
  let rampUpTimeMsg = '데이터 부족';
  if (rampUpTimeVal !== null) {
    if (rampUpTimeVal >= thresholds.rampUpTimeMin && rampUpTimeVal <= thresholds.rampUpTimeMax) {
      rampUpTimeStatus = 'PASS';
      rampUpTimeMsg = 'Initial ramp-up time is within optimal range.';
    } else if (rampUpTimeVal > thresholds.rampUpTimeMax) {
      rampUpTimeStatus = 'WARNING';
      rampUpTimeMsg = '⚠️ Ramp-up time too long! Productivity decrease and possible early flux drying.';
    } else {
      rampUpTimeStatus = 'FAIL';
      rampUpTimeMsg = '⚠️ Ramp-up time too short! Risk of severe thermal shock to components.';
    }
  }

  // 2. Preheat / Soak Duration (Soak Start Temp to Soak End Temp)
  const pSoakEnd = points.find(d => d.temp2 >= thresholds.soakEndTemp);
  let soakDur: number | null = null;
  let soakStatus: 'PASS' | 'FAIL' | 'WARNING' = 'FAIL';
  let soakMsg = 'Failed to reach soak end temperature';

  if (pSoakStart && pSoakEnd && pSoakEnd.time > pSoakStart.time) {
    soakDur = pSoakEnd.time - pSoakStart.time;
    if (soakDur >= thresholds.soakDurationMin && soakDur <= thresholds.soakDurationMax) {
      soakStatus = 'PASS';
      soakMsg = 'Optimal preheat/soak duration achieved. Even temperature distribution established.';
    } else if (soakDur > thresholds.soakDurationMax) {
      soakStatus = 'FAIL';
      soakMsg = '⚠️ Soak time too long! Causes Flux Exhaustion before reflow, risking pad oxidation and non-wetting.';
    } else {
      soakStatus = 'FAIL';
      soakMsg = '⚠️ Soak time too short! Temperature delta (ΔT) variation may lead to Tombstone / Manhattan defects.';
    }
  }

  // 5. Peak Temperature (Peak)
  const pPeak = points.reduce((prev, curr) => (prev.temp2 > curr.temp2 ? prev : curr));
  const peakT = pPeak.temp2;
  let peakStatus: 'PASS' | 'FAIL' | 'WARNING' = 'FAIL';
  let peakMsg = 'Failed to reach peak temperature';

  if (peakT >= thresholds.peakTempMin && peakT <= thresholds.peakTempMax) {
    peakStatus = 'PASS';
    peakMsg = 'Peak temperature is within the recommended specification. Excellent bonding strength.';
  } else if (peakT > thresholds.peakTempMax) {
    peakStatus = 'FAIL';
    peakMsg = `⚠️ Peak temperature exceeded limit! Risk of package delamination, component carbonization, or silicon die damage. (Max: ${thresholds.peakTempMax}°C)`;
  } else {
    peakStatus = 'FAIL';
    peakMsg = '⚠️ Peak temperature too low! Incomplete melting, leading to low mechanical strength and cold joints.';
  }

  // Time at Peak (Peak - 5°C limit)
  let timeAtPeakVal: number | null = null;
  let timeAtPeakStatus: 'PASS' | 'FAIL' | 'WARNING' = 'FAIL';
  let timeAtPeakMsg = '데이터 부족';

  const peakMinus5 = peakT - 5;
  const reversedPoints = [...points].reverse();
  const pPeakStart = points.find(d => d.temp2 >= peakMinus5);
  const pPeakEnd = reversedPoints.find(d => d.temp2 >= peakMinus5);
  
  if (pPeakStart && pPeakEnd && pPeakEnd.time >= pPeakStart.time) {
    timeAtPeakVal = pPeakEnd.time - pPeakStart.time;
    if (timeAtPeakVal >= thresholds.timeAtPeakMin && timeAtPeakVal <= thresholds.timeAtPeakMax) {
      timeAtPeakStatus = 'PASS';
      timeAtPeakMsg = 'Optimal time at peak achieved. Excellent IMC formation.';
    } else if (timeAtPeakVal > thresholds.timeAtPeakMax) {
      timeAtPeakStatus = 'FAIL';
      timeAtPeakMsg = '⚠️ Time at peak too long! Component thermal damage or overly brittle IMC layer growth expected.';
    } else {
      timeAtPeakStatus = 'WARNING';
      timeAtPeakMsg = '⚠️ Time at peak too short! IMC might be too thin, reducing mechanical joint strength.';
    }
  }

  // 3. Ramp-up to Peak Rate (Soak End Temp to Peak)
  let reflowRampUpRate: number | null = null;
  let reflowRampUpStatus: 'PASS' | 'FAIL' | 'WARNING' = 'FAIL';
  let reflowRampUpMsg = 'Failed to analyze peak rate';

  if (pSoakEnd && pPeak.time > pSoakEnd.time) {
    reflowRampUpRate = (peakT - pSoakEnd.temp2) / (pPeak.time - pSoakEnd.time);
    if (reflowRampUpRate >= thresholds.reflowRampUpMin && reflowRampUpRate <= thresholds.reflowRampUpMax) {
      reflowRampUpStatus = 'PASS';
      reflowRampUpMsg = 'Reflow ramp-up rate is within the stable specification.';
    } else if (reflowRampUpRate > thresholds.reflowRampUpMax) {
      reflowRampUpStatus = 'WARNING';
      reflowRampUpMsg = '⚠️ Rapid reflow ramp-up! Thermal stress may cause substrate warping or ceramic component micro-cracking.';
    } else {
      reflowRampUpStatus = 'WARNING';
      reflowRampUpMsg = '⚠️ Slow reflow ramp-up! Extended exposure to high temperatures may damage heat-sensitive components.';
    }
  }

  // 4. TAL (Time Above Liquidus)
  const pReflowIn = points.find(d => d.temp2 >= thresholds.liquidusTemp);
  const pReflowOut = [...points].reverse().find(d => d.temp2 >= thresholds.liquidusTemp);
  let talVal: number | null = null;
  let talStatus: 'PASS' | 'FAIL' | 'WARNING' = 'FAIL';
  let talMsg = 'Failed to reach liquidus temperature';

  if (pReflowIn && pReflowOut && pReflowOut.time > pReflowIn.time) {
    talVal = pReflowOut.time - pReflowIn.time;
    if (talVal >= thresholds.talMin && talVal <= thresholds.talMax) {
      talStatus = 'PASS';
      talMsg = 'Liquidus time (TAL) is optimal, forming a highly reliable Intermetallic Compound (IMC) layer.';
    } else if (talVal > thresholds.talMax) {
      talStatus = 'FAIL';
      talMsg = `⚠️ TAL exceeded! Intermetallic Compound (IMC) layer becomes too thick (>3μm), leading to a brittle joint.`;
    } else {
      talStatus = 'FAIL';
      talMsg = `⚠️ TAL too short! Insufficient IMC layer formation, causing cold joints or non-wetting defects.`;
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
  let coolingMsg = 'Insufficient data for cooling stage';

  if (pCoolEnd && pCoolEnd.time > pPeak.time) {
    coolingRate = (pCoolEnd.temp2 - peakT) / (pCoolEnd.time - pPeak.time); // Negative value
    const absCooling = Math.abs(coolingRate);
    const absMin = Math.abs(thresholds.coolingMax); // e.g. 1.0
    const absMax = Math.abs(thresholds.coolingMin); // e.g. 4.0

    if (absCooling >= absMin && absCooling <= absMax) {
      coolingStatus = 'PASS';
      coolingMsg = 'Optimal cooling rate achieved. Forms a fine, uniform tin crystal structure for maximum joint reliability.';
    } else if (absCooling > absMax) {
      coolingStatus = 'FAIL';
      coolingMsg = `⚠️ Rapid cooling! High thermal contraction stress between substrate (FR4) and component leads to micro-cracks.`;
    } else {
      coolingStatus = 'FAIL';
      coolingMsg = '⚠️ Slow cooling! Grain coarsening occurs, weakening joint mechanical strength and service life.';
    }
  }

  // Calculate Overall Status
  const statuses = [rampUpStatus, rampUpTimeStatus, soakStatus, reflowRampUpStatus, talStatus, peakStatus, timeAtPeakStatus, coolingStatus];
  let overallStatus: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';
  if (statuses.includes('FAIL')) {
    overallStatus = 'FAIL';
  } else if (statuses.includes('WARNING')) {
    overallStatus = 'WARNING';
  }



  return {
    solderType,
    rampUp: {
      name: '초기 승온 속도 (Initial Ramp-up Rate)',
      value: rampUpRate,
      unit: '°C/s',
      status: rampUpStatus,
      minLimit: thresholds.rampUpMin,
      maxLimit: thresholds.rampUpMax,
      description: `상온에서 예열 시작 온도(${thresholds.soakStartTemp}°C)까지의 상승 속도`,
      message: rampUpMsg,
    },
    rampUpTime: {
      name: '초기 승온 시간 (Ramp-up Time)',
      value: rampUpTimeVal,
      unit: 's',
      status: rampUpTimeStatus,
      minLimit: thresholds.rampUpTimeMin,
      maxLimit: thresholds.rampUpTimeMax,
      description: `상온에서 예열 시작 온도(${thresholds.soakStartTemp}°C)에 도달할 때까지 소요된 총 시간`,
      message: rampUpTimeMsg,
    },
    soakDuration: {
      name: '예열 소크 시간 (Preheat / Soak Time)',
      value: soakDur,
      unit: 's',
      status: soakStatus,
      minLimit: thresholds.soakDurationMin,
      maxLimit: thresholds.soakDurationMax,
      description: `${thresholds.soakStartTemp}°C에서 ${thresholds.soakEndTemp}°C까지의 예열 유지 시간`,
      message: soakMsg,
    },
    reflowRampUp: {
      name: '리플로우 승온 속도 (Reflow Ramp-up Rate)',
      value: reflowRampUpRate,
      unit: '°C/s',
      status: reflowRampUpStatus,
      minLimit: thresholds.reflowRampUpMin,
      maxLimit: thresholds.reflowRampUpMax,
      description: `예열 종료 온도(${thresholds.soakEndTemp}°C)에서 최고 피크 온도까지의 승온 기울기`,
      message: reflowRampUpMsg,
    },
    tal: {
      name: '액상선 이상 유지 시간 (TAL)',
      value: talVal,
      unit: 's',
      status: talStatus,
      minLimit: thresholds.talMin,
      maxLimit: thresholds.talMax,
      description: `액상선 온도(${thresholds.liquidusTemp}°C) 이상에서 솔더가 용융되어 유지되는 시간`,
      message: talMsg,
    },
    peakTemp: {
      name: '최고 온도 (Peak Temperature)',
      value: peakT,
      unit: '°C',
      status: peakStatus,
      minLimit: thresholds.peakTempMin,
      maxLimit: thresholds.peakTempMax,
      description: '전체 프로파일에서 측정된 열전쌍(TC2)의 최고점 온도',
      message: peakMsg,
    },
    timeAtPeak: {
      name: '피크 지속 시간 (Time at Peak)',
      value: timeAtPeakVal,
      unit: 's',
      status: timeAtPeakStatus,
      minLimit: thresholds.timeAtPeakMin,
      maxLimit: thresholds.timeAtPeakMax,
      description: `최고 피크 온도에서 -5°C 이내 고온 영역에 머문 시간`,
      message: timeAtPeakMsg,
    },
    cooling: {
      name: '하강 냉각 속도 (Cooling Rate)',
      value: coolingRate,
      unit: '°C/s',
      status: coolingStatus,
      minLimit: thresholds.coolingMin,
      maxLimit: thresholds.coolingMax,
      description: `최고 피크 온도 도달 시점부터 안전 온도(100°C)까지의 평균 냉각 속도`,
      message: coolingMsg,
    },
    overallStatus,
  };
};
