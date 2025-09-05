import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['./src/index.ts', './src/plugins/*.ts'],
  external: ['./src/utils.ts'],
  outDir: 'dist',
  format: 'esm',
  dts: true,
  clean: true,
  minify: true,
})
