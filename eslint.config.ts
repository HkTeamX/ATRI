import antfu from '@antfu/eslint-config'

export default antfu(
  {
    type: 'lib',
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/drizzle/**',
      '**/.eslintcache',
    ],
  },
  {
    rules: {
      'ts/explicit-function-return-type': 'off',
    },
  },
  {
    files: ['./packages/core/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
)
