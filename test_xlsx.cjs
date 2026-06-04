const XLSX = require('xlsx');
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([
  ["날짜", "시간", "TC1", "TC2"],
  ["2023-01-01", "14:20:30", "25.0", "26.0"],
  ["2023-01-01", 0.597569444444444, 25.5, 26.5] // Excel time
]);
ws['B3'].z = 'hh:mm:ss'; // Set format
XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
const csv = XLSX.utils.sheet_to_csv(ws);
console.log("CSV:", csv);
