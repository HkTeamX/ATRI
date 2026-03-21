import fs from 'node:fs'
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['./src/index.ts'],
  outDir: 'dist',
  format: 'esm',
  dts: true,
  clean: true,
  minify: true,
  async onSuccess() {
    const src = './src/static'
    const dest = './dist/static'

    fs.cpSync(src, dest, { recursive: true })
    console.log('✔ 静态文件已复制')
  },
})
