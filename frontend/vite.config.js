import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: './frontend', // <--- Añade esto para que Vite sepa dónde buscar el index.html
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000'
    }
  },
  build: { 
    outDir: '../frontend/dist', // Ajusta la salida si compilas desde la raíz
    emptyOutDir: true
  }
});