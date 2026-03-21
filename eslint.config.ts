import antfu from '@antfu/eslint-config'

export default antfu(
  {
    type: 'lib',
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/drizzle/**',
      '**/.eslintcache',
      '**/backend/public/**',
    ],
  },
  {
    files: ['./packages/core/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    rules: {
      'ts/explicit-function-return-type': 'off',
    },
  },
)
