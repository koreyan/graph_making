import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        // Electron main process entry point
        entry: 'electron/main.ts',
      },
    }),
  ],
  // Prevent Vite from clearing the screen during Electron dev mode
  clearScreen: false,
})
