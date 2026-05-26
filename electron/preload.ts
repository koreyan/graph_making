import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getCsvFiles: () => ipcRenderer.invoke('get-csv-files'),
  readCsvFile: (filepath: string) => ipcRenderer.invoke('read-csv-file', filepath),
  selectCsvDirectory: () => ipcRenderer.invoke('select-csv-directory'),
});
