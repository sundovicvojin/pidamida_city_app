import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // relativne putanje: radi na domenu, subdomenu i u podfolderu
  build: { target: 'es2022', sourcemap: false },
  server: { host: true },
});
