import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react'; // o @vitejs/plugin-react-swc
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Fuerza a todo el proyecto (incluido react-i18next) a usar el MISMO React
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
    },
  },
});