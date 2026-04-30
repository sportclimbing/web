import { defineConfig } from 'astro/config';

const isProduction = process.env.NODE_ENV === 'production';
const doMinify = isProduction ? 'esbuild' : false;

export default defineConfig({
  site: 'https://ifsc.stream',
  output: 'static',
  trailingSlash: 'always',
  integrations: [],
  vite: {
    build: {
      minify: doMinify,
      cssMinify: doMinify,
    },
  },
});
