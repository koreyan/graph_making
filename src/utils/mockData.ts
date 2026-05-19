export interface ReflowDataPoint {
  time: number;
  temp1: number;
  temp2: number;
  temp3: number;
  temp4: number;
  rawTime: string;
}

export const generateMockReflowData = (): ReflowDataPoint[] => {
  const data: ReflowDataPoint[] = [];
  const totalSeconds = 480;
  
  // Typical Reflow Stages:
  // 0-60s: Initial Ramp Up (Room temp to ~150C)
  // 60-180s: Preheat/Soak (~150C to ~180C)
  // 180-240s: Ramp up to Reflow (~180C to 217C)
  // 240-300s: Reflow (Peak at ~255C)
  // 300-480s: Cooling
  
  for (let s = 0; s <= totalSeconds; s++) {
    let temp = 25; // Start at room temp
    
    if (s <= 60) {
      // First Ramp Up: 2C/s
      temp = 25 + s * 2.08; 
    } else if (s <= 180) {
      // Soak: slower rise 150 to 180
      temp = 150 + (s - 60) * 0.25;
    } else if (s <= 250) {
      // Second Ramp: 180 to 255
      temp = 180 + (s - 180) * 1.07;
    } else if (s <= 310) {
      // Peak and start of cooling
      temp = 255 - (s - 250) * 1.0;
    } else {
      // Cooling: -1.5C/s
      temp = 195 - (s - 310) * 1.0;
    }
    
    // Add some noise
    temp += (Math.random() - 0.5) * 1.5;
    if (temp < 25) temp = 25;

    data.push({
      time: s,
      temp1: temp - 2,
      temp2: temp,
      temp3: temp + 1,
      temp4: temp - 5,
      rawTime: new Date(Date.now() + s * 1000).toLocaleTimeString()
    });
  }
  
  return data;
};
