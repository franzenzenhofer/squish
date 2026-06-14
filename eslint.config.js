import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      'no-console': ['error', { allow: ['error', 'warn', 'info'] }],
      'prefer-const': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }]
    }
  },
  {
    files: ['scripts/**'],
    languageOptions: {
      globals: {
        process: 'readonly', console: 'readonly', setTimeout: 'readonly',
        window: 'readonly', document: 'readonly'
      }
    },
    rules: { 'no-console': 'off' }
  }
);
