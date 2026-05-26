export interface ElectronAPI {
  getCsvFiles: () => Promise<{ files?: { name: string, path: string }[], error?: string }>;
  readCsvFile: (filepath: string) => Promise<{ content?: string, error?: string }>;
  selectCsvDirectory: () => Promise<{ canceled?: boolean, dirPath?: string, files?: { name: string, path: string }[], error?: string }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
