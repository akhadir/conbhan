import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages project site: https://akhadir.github.io/conbhan/
export default defineConfig({
  base: '/conbhan/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },
});
