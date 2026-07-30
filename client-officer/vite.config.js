import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // '@' → './src' for clean imports: import X from '@/components/X'
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    // Uncomment when Express backend is running:
    // proxy: { '/api': 'http://localhost:5000' },
  },
});
