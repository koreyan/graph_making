import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

// Create dummy xlsx
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([["날짜"], ["2023-01-01"]]);
XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
XLSX.writeFile(wb, "test.xlsx");

// Test read logic
try {
  const filepath = path.resolve("test.xlsx");
  const workbook = XLSX.readFile(filepath);
  let targetSheetName = workbook.SheetNames[0];
  let maxRows = 0;
  
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (sheet['!ref']) {
      const range = XLSX.utils.decode_range(sheet['!ref']);
      const rowCount = range.e.r - range.s.r;
      if (rowCount > maxRows) {
        maxRows = rowCount;
        targetSheetName = name;
      }
    }
  }
  
  const csvContent = XLSX.utils.sheet_to_csv(workbook.Sheets[targetSheetName]);
  console.log("Success:", csvContent);
} catch (err) {
  console.error("Error:", err.message);
}
