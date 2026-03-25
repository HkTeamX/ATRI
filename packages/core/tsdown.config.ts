import { defineConfig } from 'tsdown'

export default defineConfig({
  minify: true,
  deps: {
    neverBundle: ['bun'],
  },
})
