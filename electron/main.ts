import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

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

app.whenReady().then(createWindow);
