import Papa from 'papaparse';

export interface ReflowDataPoint {
  time: number; // Elapsed normalized time in seconds
  temp1: number;
  temp2: number;
  temp3: number;
  temp4: number;
  rawTime: string;
}

export interface ReflowMetaData {
  deviceName: string;
  deviceDescription: string;
  serialNumber: string;
  deviceId: string;
  channels: string[];
}

// Robust time parser for AM/PM, 오전/오후 formats
export const parseTimeToSeconds = (timeStr: string): number => {
  const clean = timeStr.trim();
  if (!clean) return 0;
  
  let isPM = false;
  let hasPeriod = false;
  
  const lower = clean.toLowerCase();
  if (lower.includes('pm') || lower.includes('오후')) {
    isPM = true;
    hasPeriod = true;
  } else if (lower.includes('am') || lower.includes('오전')) {
    isPM = false;
    hasPeriod = true;
  }
  
  // Strip out AM/PM / 오전/오후 markers
  const timePart = clean.replace(/(pm|am|오후|오전)/gi, '').trim();
  const parts = timePart.split(':');
  if (parts.length < 3) {
    return 0;
  }
  
  let hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parseInt(parts[2], 10);
  
  if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
    return 0;
  }
  
  if (hasPeriod) {
    if (isPM && hours !== 12) {
      hours += 12;
    } else if (!isPM && hours === 12) {
      hours = 0;
    }
  }
  
  return hours * 3600 + minutes * 60 + seconds;
};

export const parseCSV = (file: File): Promise<{ data: ReflowDataPoint[], meta: ReflowMetaData }> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      complete: (results) => {
        const rows = results.data as string[][];
        if (rows.length < 5) {
          reject(new Error('CSV 파일의 형식이 올바르지 않습니다: 데이터가 너무 적습니다.'));
          return;
        }

        // Dynamically find the header row starting with "날짜" or "Date"
        let headerRowIndex = -1;
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (row && row[0] && (row[0].trim() === '날짜' || row[0].trim().toLowerCase() === 'date')) {
            headerRowIndex = i;
            break;
          }
        }

        // Fallback to index 7 if not found dynamically
        if (headerRowIndex === -1) {
          headerRowIndex = 7;
        }

        // Dynamically extract metadata from rows before the header row
        let deviceName = 'Unknown';
        let deviceDescription = 'Unknown';
        let serialNumber = 'Unknown';
        let deviceId = 'Unknown';

        for (let i = 0; i < headerRowIndex; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          
          const label = row[0]?.trim() || '';
          // Find the first non-empty cell after the label
          const val = row.find((cell, index) => index > 0 && cell?.trim() !== '')?.trim() || '';
          
          if (label.includes('기기 이름') || label.includes('Device Name')) {
            deviceName = val;
          } else if (label.includes('기기 설명') || label.includes('Description')) {
            deviceDescription = val;
          } else if (label.includes('일련 번호') || label.includes('Serial Number')) {
            serialNumber = val;
          } else if (label.includes('기기 ID') || label.includes('Device ID')) {
            deviceId = val;
          }
        }

        // Extract channel labels from the row immediately preceding the header row, if any
        let channels: string[] = [];
        if (headerRowIndex > 0) {
          const channelsRow = rows[headerRowIndex - 1] || [];
          channels = channelsRow.map(c => c?.trim()).filter(Boolean);
        }
        if (channels.length === 0) {
          channels = ['TC1', 'TC2', 'TC3', 'TC4']; // fallback
        }

        const meta: ReflowMetaData = {
          deviceName,
          deviceDescription,
          serialNumber,
          deviceId,
          channels
        };

        // Parse Data Rows
        const data: ReflowDataPoint[] = [];
        let firstTimeInSeconds: number | null = null;
        let lastTimeSeconds = -1;
        let dayOffset = 0;

        for (let i = headerRowIndex + 1; i < rows.length; i++) {
          const row = rows[i];
          // CSV has columns: Date, Time, Temp1, Temp2, Temp3, Temp4
          if (!row || row.length < 4 || !row[1]) continue;

          // Parse time using robust AM/PM parser
          const rawTime = row[1].trim();
          let seconds = parseTimeToSeconds(rawTime);

          // Midnight crossing/rollover protection
          if (lastTimeSeconds !== -1 && seconds < lastTimeSeconds - 43200) {
            dayOffset += 86400; // Add 24 hours
          }
          lastTimeSeconds = seconds;
          const absoluteSeconds = seconds + dayOffset;

          if (firstTimeInSeconds === null) {
            firstTimeInSeconds = absoluteSeconds;
          }

          const relativeTime = absoluteSeconds - firstTimeInSeconds;

          // Temperatures are at indices 2, 3, 4, 5
          const t1 = parseFloat(row[2]);
          const t2 = parseFloat(row[3]);
          const t3 = parseFloat(row[4]);
          const t4 = parseFloat(row[5]);

          // Handle -270 as NaN (sensor disconnected)
          const cleanTemp = (t: number) => (t <= -270 || isNaN(t) ? NaN : t);

          data.push({
            time: relativeTime,
            temp1: cleanTemp(t1),
            temp2: cleanTemp(t2),
            temp3: cleanTemp(t3),
            temp4: cleanTemp(t4),
            rawTime,
          });
        }

        // Sort data by normalized time just in case of any jitter
        data.sort((a, b) => a.time - b.time);

        resolve({ data, meta });
      },
      error: (error) => reject(error),
    });
  });
};
