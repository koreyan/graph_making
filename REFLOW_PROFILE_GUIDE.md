# 반도체 리플로우(Reflow) 온도 프로파일 분석 및 시각화 가이드

본 가이드는 반도체 및 SMT(Surface Mount Technology) 공정에서 솔더 조인트(Solder Joint)의 완벽한 접합 신뢰성을 확보하기 위해 필수적인 **온도 프로파일(Temperature Profile)**의 핵심 구간을 설명하고, 이를 소프트웨어적으로 어떻게 자동 계산하고 시각화할 수 있는지 구체적인 가이드를 제공합니다.

---

## 1. 리플로우 온도 프로파일 핵심 개요

리플로우 공정은 솔더 페이스트(Solder Paste)를 기판에 도포하고 부품을 실장한 후, 컨베이어 벨트를 통해 온도 챔버(Reflow Oven)를 통과시키며 열을 가해 납을 녹이고 굳혀 접합하는 공정입니다. 

현대 반도체 및 전자 패키징 산업에서 널리 쓰이는 **무연 솔더(Pb-Free, 예: SAC305 - Sn96.5 / Ag3.0 / Cu0.5)** 기준으로 온도 제어 프로파일은 일반적으로 **5대 핵심 구간**으로 나뉩니다.

### 📊 리플로우 온도 프로파일 시각적 모형 (SAC305 기준)

```
온도 (°C)
  ^
  |                                                  [Peak Temp: 235~250°C]
  |                                                          _/\_
  |                                                         /    \  <-- (5) Ramp-down (Cooling)
  |                                                        /      \      [-1.0 ~ -4.0 °C/sec]
  |                     Ramp-up to Peak                   / Reflow \
  |                   [1.0 ~ 2.0 °C/sec]                 /   (TAL)  \
  |                                                     /  (>217°C)  \
217 --------------------------------------------------/--[45~90s]---\----------------- (액상선 온도)
  |                                                  /                \
200 -------------------------------\---------------/                  \
  |                                 \    Soak     /                    \
  |      (2) Preheat / Soak          \ [60~120s] /                      \
  |      [150°C ~ 200°C Zone]         \---------/                        \
150 ----------------------------------|                                   \
  |                                 / |                                    \
  |      (1) Ramp-up              /   |                                     \
  |      [1.0 ~ 3.0 °C/sec]     /     |                                      \
  |                           /       |                                       \
 25 +-----------------------/---------+---------------------------------------> 시간 (sec)
   (상온)
```

---

## 2. 5대 핵심 구간 상세 분석 및 온도 기준

### ① 초기 승온 구간 (Ramp-up Zone)
*   **구간 정의**: 상온(25°C)에서 예열 시작 온도(150°C)까지 도달하는 첫 번째 승온 구간입니다.
*   **온도 속도 (Slope)**: 초당 **1.0°C ~ 3.0°C** 상승이 적정 기준입니다. (권장: **2.0°C/sec 이하**)
*   **공정 목적**: 기판과 부품을 상온에서 납조 내 급격한 고온 영역으로 완만하게 유도합니다.
*   **불량 요인**: 
    *   **과도한 승온 (>3°C/s)**: 급격한 열팽창 차이로 패키지 내부나 세라믹 커패시터에 **열 충격 균열(Thermal Shock Crack)**이 발생하거나 솔더 페이스트 내 용매가 순간 비등하여 솔더 볼이 사방으로 튀는 **솔더 볼(Solder Balling)** 현상이 발생합니다.

### ② 예열 및 소크 구간 (Preheat / Soak Zone)
*   **구간 정의**: 일반적으로 무연 솔더(SAC305) 기준 **150°C에서 200°C** 사이의 평탄하거나 완만한 온도 상승 영역입니다.
*   **소요 시간 (Duration)**: 일반적으로 **60초 ~ 120초** 동안 유지합니다.
*   **공정 목적**:
    1.  **플럭스(Flux) 활성화**: 솔더 페이스트 내부 플럭스가 활성화되어 전극 표면의 산화막을 화학적으로 제거하고 젖음성(Wettability)을 확보합니다.
    2.  **온도 균일화**: 상대적으로 열용량(Thermal Mass)이 큰 대형 부품(BGA, Connector)하고 열용량이 작은 미세 칩(0402, 0603) 간의 기판 내 **온도 편차($\Delta T$)를 균일하게** 맞춰줍니다.
*   **불량 요인**:
    *   **과도한 시간 (>120s)**: 플럭스가 리플로우 액상 구간에 도달하기 전에 모두 증발/연소해버려(Flux Exhaustion) 멜팅 및 젖음 불량, 패드 산화가 일어납니다.
    *   **짧은 예열 (<60s)**: 온도 불균일로 인해 납이 한쪽부터 먼저 녹아 칩 부품이 세로로 서는 **툼스톤(Tombstone / 맨해튼 현상)**이 유발되거나 기판 변형이 일어납니다.

### ③ 리플로우 승온 구간 (Ramp-up to Peak Zone)
*   **구간 정의**: 예열이 끝나는 시점(200°C)에서 본격적으로 납이 녹기 시작하는 액상선(217°C)을 지나 최고 온도(Peak)에 도달하기까지의 구간입니다.
*   **온도 속도 (Slope)**: 초당 **1.0°C ~ 2.0°C** 상승이 적정 기준입니다.
*   **공정 목적**: 납이 완벽하게 융해되어 금속 간 결합을 이룰 수 있도록 충분한 운동에너지를 공급합니다.

### ④ 리플로우 및 액상선 통과 구간 (Reflow Zone / TAL)
*   **구간 정의**: 솔더 페이스트가 고체에서 액체로 완전히 변하는 **액상선 온도인 217°C 이상으로 머무는 영역**입니다.
*   **액상선 이상 유지 시간 (TAL, Time Above Liquidus)**: **45초 ~ 90초** (일부 특수 제품은 60초 ~ 120초)가 최적 기준입니다.
*   **공정 목적**: 녹은 솔더와 기판 동 패드 계면 사이에서 구리와 주석 성분이 결합하여 기계적 강도를 갖추는 **금속간화합물(IMC, Intermetallic Compound)**을 생성하는 핵심 단계입니다.
*   **불량 요인**:
    *   **너무 짧은 TAL (<40s)**: 계면에 적절한 화학적 결합이 이루어지지 않아 기계적 응력에 약한 **냉납(Cold Joint)** 혹은 비젖음(Non-wetting) 현상이 발생합니다.
    *   **너무 긴 TAL (>90s)**: IMC 층이 3μm 이상 너무 두껍게 형성되어 솔더 결합부의 연성이 극도로 낮아지고 쉽게 부러지는 취성(Brittle Joint) 상태가 되며 부품이 과열 손상됩니다.

### ⑤ 최고 온도 구간 (Peak Temperature Zone)
*   **구간 정의**: 프로파일 전체에서 측정되는 **가장 높은 온도(최고점)**입니다.
*   **온도 범위**: 무연 솔더 기준 **235°C ~ 250°C** 내외가 표준이며, 타겟은 대개 **240°C ~ 245°C**입니다.
*   **최고점 부근 유지 시간**: Peak 온도 기준 5°C 이내 영역에서 머무는 시간이 **10초 ~ 30초** 수준이어야 합니다.
*   **불량 요인**:
    *   **230°C 미만**: 리플로우가 불완전하여 결합력이 극도로 떨어집니다.
    *   **260°C 초과**: 부품 몰드 하우징 탄화, 패키지 딜레이미네이션(Delamination), 실리콘 칩 영구 파괴 등 **심각한 부품 열손상**을 유발합니다.

### ⑥ 강온 및 냉각 구간 (Ramp-down / Cooling Zone)
*   **구간 정의**: 최고 온도(Peak) 또는 액상선(217°C) 이하에서 상온으로 제어하여 온도를 내리는 구간입니다.
*   **온도 하강 속도 (Cooling Slope)**: 초당 **-1.0°C ~ -4.0°C** 범위가 필수적이며, 권장 타겟은 **-3.0°C/sec** 전후입니다.
*   **공정 목적**: 액화 상태의 솔더를 신속하게 고체화하여 미세한 결정립 구조를 확보함으로써 조인트 강도를 높입니다.
*   **불량 요인**:
    *   **너무 느린 냉각 (>-1°C/s)**: 솔더 조인트의 주석 결정(Grain Size)이 커져서 조직이 거칠어지고 기계적 수명이 짧아집니다.
    *   **너무 빠른 냉각 (<-6°C/s)**: 기판(FR4)과 세라믹 소자의 열수축 편차로 솔더 조인트에 크랙이 가거나 부품이 파손될 수 있습니다.

---

## 3. 솔더 타입별 핵심 프로파일 비교 요약

프로파일 설계 시 사용되는 납의 성분에 따라 기준 온도가 상이합니다.

| 공정 항목 | Pb-Free 무연 솔더 (SAC305) | Leaded 유연 솔더 (Sn63/Pb37) | 비고 |
| :--- | :--- | :--- | :--- |
| **액상선 온도 (Liquidus)** | **217 °C** | **183 °C** | 융점(Melting Point) |
| **초기 승온 기울기** | 1.0 ~ 3.0 °C/sec | 1.0 ~ 3.0 °C/sec | 25°C ➔ 예열 시작점 |
| **예열/소크 온도 구간** | **150 °C ~ 200 °C** | **100 °C ~ 150 °C** | 플럭스 활성화 및 균일화 |
| **예열/소크 유지 시간** | 60 ~ 120 sec | 60 ~ 120 sec | 너무 길면 패드 산화 유발 |
| **TAL (액상선 이상 유지 시간)** | **45 ~ 90 sec** (또는 60~120s) | **60 ~ 90 sec** | 접합 강도 결정 시간 |
| **최고 온도 (Peak Temp)** | **235 °C ~ 250 °C** (Max 260°C) | **210 °C ~ 230 °C** (Max 240°C) | 한계 초과 시 부품 사망 |
| **냉각 속도 (Cooling Slope)** | -1.0 ~ -4.0 °C/sec | -1.0 ~ -4.0 °C/sec | 미세조직 형성 구간 |

---

## 4. 리플로우 차트 구현 및 자동 계산 방법 (React + Highcharts)

현재 구현하고 계시는 `ReflowChart.tsx` 및 데이터 명세를 기반으로, 이 구간들을 차트에 정밀하게 반영하고 **수치적 통계 지표**를 엔지니어 화면에 실시간으로 요약 계산해 주기 위한 가이드를 작성합니다.

> [!NOTE]
> 데이터 채널 기준은 PRD 요구사항대로 `TC2 (Thermocouple 2, temp2)` 채널을 핵심 분석 기준으로 삼습니다.

### 📐 핵심 구간 자동 계산 물리 공식 및 로직 구현 예시

차트 내부 훅 또는 분석 유틸리티에서 다음과 같은 방식으로 수치를 계산해 화면에 함께 표기해 줍니다.

```typescript
// Reflow Analysis Metrics Interface
export interface ReflowAnalysisMetrics {
  rampUpRate: number;      // 초기 승온 속도 (°C/s)
  preheatDuration: number; // 예열 유지 시간 (sec)
  soakStartTemp: number;   // 소크 시작 실제 온도
  soakEndTemp: number;     // 소크 끝 실제 온도
  reflowRampUpRate: number;// 피크 도달 직전 승온 속도
  tal: number;             // Time Above Liquidus (sec)
  peakTemp: number;        // 최고 온도 (°C)
  peakTime: number;        // 최고 온도 도달 경과 시간 (sec)
  coolingRate: number;     // 냉각 속도 (°C/s)
}
```

#### 1) 초기 승온 기울기 (Ramp-up Rate)
*   **로직**: 상온(보통 첫 데이터 포인트 $T_{start}$ 및 $t_{start}$)부터 예열 온도가 시작되는 $T = 150^\circ\text{C}$ 지점까지의 온도 변화를 시간차로 나눕니다.
*   **공식**: 
    $$\text{Slope}_{\text{ramp-up}} = \frac{T_{150} - T_{start}}{t_{150} - t_{start}}$$

#### 2) 예열 소크 시간 (Preheat/Soak Duration)
*   **로직**: 온도가 처음으로 $150^\circ\text{C}$를 통과한 지점의 시간($t_{150}$)과 처음으로 $200^\circ\text{C}$를 통과한 지점의 시간($t_{200}$)의 편차를 계산합니다.
*   **공식**:
    $$\text{Duration}_{\text{soak}} = t_{200} - t_{150}$$

#### 3) TAL (Time Above Liquidus) 계산
*   **로직**: 온도가 처음으로 $217^\circ\text{C}$를 이상으로 도달한 시점($t_{reflow\_in}$)부터 최고 온도를 찍고 내려오면서 마지막으로 $217^\circ\text{C}$ 아래로 떨어지는 시점($t_{reflow\_out}$) 사이의 간격입니다.
*   **공식**:
    $$\text{TAL} = t_{reflow\_out} - t_{reflow\_in}$$

#### 4) 최고 온도 (Peak Temperature)
*   **로직**: 데이터 중 `temp2` 값이 가장 큰 포인트를 탐색합니다.
*   **공식**:
    $$\text{Peak Temp} = \max(\text{temp2}_i)$$

#### 5) 강온/냉각 속도 (Cooling Rate)
*   **로직**: 피크 온도 도달 시간($t_{peak}$)부터 리플로우 온도(또는 안전 온도인 $100^\circ\text{C}$ 이하)까지 내려가는 순간의 하강 기울기입니다.
*   **공식**:
    $$\text{Slope}_{\text{cooling}} = \frac{T_{cooling\_target} - T_{peak}}{t_{cooling\_target} - t_{peak}}$$

---

## 5. Highcharts 실전 고도화 구현 예제

현재 사용 중이신 `ReflowChart.tsx` 파일에 아래와 같은 차트 기술을 적용하면 엔지니어링 보고서 수준의 수려한 차트가 완성됩니다.

### 🎨 1. 핵심 타겟 가이드라인 (`plotLines`)
Y축 온도 스케일에 공정 기준점들을 시각적으로 얇은 점선으로 주어, 사용자가 직관적으로 영역을 한눈에 알 수 있게 돕습니다.
```typescript
yAxis: {
  plotLines: [
    {
      value: 150,
      color: 'rgba(255, 165, 0, 0.4)', // 연한 오렌지 (Soak Start)
      dashStyle: 'Dash',
      width: 1.5,
      label: {
        text: 'Preheat Start (150°C)',
        style: { color: '#ffa500', fontSize: '10px' },
        align: 'right',
        x: -10
      }
    },
    {
      value: 200,
      color: 'rgba(255, 165, 0, 0.4)', // 연한 오렌지 (Soak End)
      dashStyle: 'Dash',
      width: 1.5,
      label: {
        text: 'Preheat End (200°C)',
        style: { color: '#ffa500', fontSize: '10px' },
        align: 'right',
        x: -10
      }
    },
    {
      value: 217,
      color: 'rgba(255, 77, 77, 0.5)', // 빨간 점선 (Liquidus)
      dashStyle: 'Dash',
      width: 2,
      label: {
        text: 'Liquidus (217°C)',
        style: { color: '#ff4d4d', fontWeight: 'bold', fontSize: '11px' },
        align: 'right',
        x: -10
      }
    }
  ]
}
```

### 🔲 2. 영역별 배경색 구분 (`plotBands`)
단순한 점선 구분을 넘어, 차트 뒷배경 영역 자체에 은은한 하이라이트를 주어 각 영역의 경계를 직관적으로 묘사할 수 있습니다.
```typescript
xAxis: {
  plotBands: [
    {
      from: 0,
      to: soakStart?.time || 60,
      color: 'rgba(0, 120, 212, 0.05)', // 승온 영역: 은은한 블루
      label: { text: 'Ramp-Up', style: { color: '#888888', fontSize: '10px' } }
    },
    {
      from: soakStart?.time || 60,
      to: soakEnd?.time || 150,
      color: 'rgba(255, 165, 0, 0.05)', // 예열 영역: 은은한 주황
      label: { text: 'Preheat / Soak', style: { color: '#888888', fontSize: '10px' } }
    },
    {
      from: reflowStart?.time || 180,
      to: reflowEnd?.time || 260,
      color: 'rgba(255, 0, 0, 0.04)', // 리플로우 영역: 은은한 레드
      label: { text: 'Reflow (TAL)', style: { color: '#888888', fontSize: '10px' } }
    }
  ]
}
```

### 🏷️ 3. Highcharts 드래그형 어노테이션 활성화 (`annotations`)
엔지니어가 마우스로 텍스트와 말풍선 박스를 자유롭게 배치하여 드래그하고 메모를 작성할 수 있도록 `Highcharts-Annotations` 모듈을 활성화합니다.
*   **활성화 방법**:
    ```typescript
    import AnnotationsModule from 'highcharts/modules/annotations';
    AnnotationsModule(Highcharts);
    ```
*   그 다음, React 컴포넌트의 `options.annotations` 배열 내부에 `draggable: 'xy'`를 기입하여 렌더링하면 보고서용 스크린샷 캡처 시 완벽한 프레젠테이션 주석 기능이 부여됩니다.

---

## 6. 결론 및 추천 설계 전략

반도체 리플로우 온도 프로파일 분석 프로그램에서 차트의 미적 수려함과 높은 가독성은 매우 중요합니다.

1.  **Dark Theme & Harmonized Colors**:
    *   배경색을 `#1e1e1e` 또는 `#2d2d2d`로 설정하고 기본 그리드라인을 연한 다크 그레이(`rgba(255,255,255,0.05)`)로 설정하여 엔지니어가 오랜 시간 응시해도 눈의 피로를 최소화합니다.
2.  **공정 요약 사이드바**:
    *   차트 우측 또는 하단 영역에 카드 컴포넌트를 배치하여 **TAL(Time Above Liquidus), Peak Temp, Soak Duration, Ramp-up/down Slopes**의 자동 수치 계산 값을 일괄 표시해 줍니다. 
    *   만약 이들 중 하나가 허용 범위(예: TAL < 45s 또는 Peak > 255°C)를 벗어나는 경우 **경고 아이콘(⚠️)** 및 **붉은색 경고 텍스트**를 출력하는 자동 안전 마진 체크 로직(Margin Check)을 추가해주면 최고의 엔지니어링 툴이 될 수 있습니다.
