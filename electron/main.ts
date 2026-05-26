import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The built directory structure
//
// ├─┬─┬ dist/
// │ │ └── index.html   -- Vite build output
// │ │
// │ └─┬ dist-electron/
// │   └── main.js      -- Electron main process (this file, compiled)
// │
// └── package.json

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    center: true,
    title: 'Reflow Profile Console',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.mjs'),
    },
    // Frameless is optional — remove these lines to keep the native OS titlebar
    show: false,
  });

  // Open external links in default browser instead of Electron window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Show window only after content is ready (avoids white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (VITE_DEV_SERVER_URL) {
    // Development: load from Vite dev server
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // Production: load built HTML file
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// Windows: Set AppUserModelId for taskbar grouping
if (process.platform === 'win32') {
  app.setAppUserModelId('com.reflowconsole.app');
}

app.on('window-all-closed', () => {
  // On macOS, apps stay in dock even when all windows are closed
  // On Windows/Linux, quit the app
  if (process.platform !== 'darwin') {
    app.quit();
  }
  mainWindow = null;
});

app.on('activate', () => {
  // macOS: re-create window when dock icon is clicked with no windows open
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(() => {
  ipcMain.handle('get-csv-files', async () => {
    const dirPath = process.env.REFLOW_CSV_DIR;
    if (!dirPath) {
      return { error: 'REFLOW_CSV_DIR 환경변수가 설정되지 않았습니다.' };
    }
    try {
      const files = fs.readdirSync(dirPath);
      const csvFiles = files.filter(f => f.toLowerCase().endsWith('.csv')).map(f => ({
        name: f,
        path: path.join(dirPath, f)
      }));
      return { files: csvFiles };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('read-csv-file', async (_, filepath: string) => {
    try {
      if (filepath.toLowerCase().endsWith('.xlsx')) {
        const workbook = XLSX.readFile(filepath);
        const sheetName = workbook.SheetNames[0];
        const csvContent = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
        return { content: csvContent };
      }

      let content = fs.readFileSync(filepath, 'utf-8');
      
      // 윈도우(한국) 엑셀에서 저장된 CSV는 기본 인코딩이 ANSI(CP949)이므로
      // UTF-8로 읽었을 때 한글이 깨지는 현상( 문자 발생)이 있으면 EUC-KR로 재디코딩합니다.
      if (content.includes('')) {
        const buffer = fs.readFileSync(filepath);
        content = new TextDecoder('euc-kr').decode(buffer);
      }
      
      return { content };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('select-csv-directory', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return { error: 'No window found' };

    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      title: 'CSV 디렉터리 선택',
      properties: ['openDirectory']
    });

    if (canceled || filePaths.length === 0) {
      return { canceled: true };
    }

    const dirPath = filePaths[0];
    try {
      const files = fs.readdirSync(dirPath);
      const csvFiles = files.filter(f => f.toLowerCase().endsWith('.csv') || f.toLowerCase().endsWith('.xlsx')).map(f => ({
        name: f,
        path: path.join(dirPath, f)
      }));
      return { dirPath, files: csvFiles };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  createWindow();
});
