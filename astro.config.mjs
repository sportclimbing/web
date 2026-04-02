import { defineConfig } from 'astro/config';

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  const doMinify = isProduction ? 'esbuild' : false;

  return {
    site: 'https://ifsc.stream',
    output: 'static',
    trailingSlash: 'never',
    vite: {
      build: {
        minify: doMinify,
        cssMinify: doMinify,
      },
    },
  };
});
