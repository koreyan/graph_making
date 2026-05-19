import Papa from 'papaparse';

export interface ReflowDataPoint {
  time: number; // Elapsed time in seconds
  temp1: number;
  temp2: number;
  temp3: number;
  temp4: number;
  rawTime: string;
}

export interface ReflowMetaData {
  deviceName: string;
  serialNumber: string;
  channels: string[];
}

export const parseCSV = (file: File): Promise<{ data: ReflowDataPoint[], meta: ReflowMetaData }> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      complete: (results) => {
        const rows = results.data as string[][];
        if (rows.length < 8) {
          reject(new Error('Invalid CSV format: Too few rows'));
          return;
        }

        // Parse Metadata
        const meta: ReflowMetaData = {
          deviceName: rows[0]?.[2]?.trim() || 'Unknown',
          serialNumber: rows[2]?.[2]?.trim() || 'Unknown',
          channels: [rows[5]?.[2], rows[5]?.[3], rows[5]?.[4], rows[5]?.[5]].map(c => c?.trim()).filter(Boolean),
        };

        // Parse Data Rows (Actual data starts from Row 8, index 7)
        const data: ReflowDataPoint[] = [];
        let firstTime: number | null = null;

        for (let i = 7; i < rows.length; i++) {
          const row = rows[i];
          // CSV has columns: Date, Time, Temp1, Temp2, Temp3, Temp4
          if (!row || row.length < 4 || !row[1]) continue;

          // Temperatures are at index 2, 3, 4, 5
          const t1 = parseFloat(row[2]);
          const t2 = parseFloat(row[3]);
          const t3 = parseFloat(row[4]);
          const t4 = parseFloat(row[5]);

          // Handle -270 as NaN (sensor disconnected)
          const cleanTemp = (t: number) => (t === -270 || isNaN(t) ? NaN : t);

          // For time, we use the row count as seconds if parsing is complex,
          // but based on data, it seems to be 1s interval.
          // Using a simple counter starting from 0 for the first valid row.
          if (firstTime === null) firstTime = i;

          data.push({
            time: i - firstTime,
            temp1: cleanTemp(t1),
            temp2: cleanTemp(t2),
            temp3: cleanTemp(t3),
            temp4: cleanTemp(t4),
            rawTime: row[1]?.trim(),
          });
        }

        resolve({ data, meta });
      },
      error: (error) => reject(error),
    });
  });
};
