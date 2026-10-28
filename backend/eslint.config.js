// Backend lint (DEV-R1). Owner: Tech Lead. Flat config, typescript-eslint recommended (no type info,
// so it stays fast and parallel-safe). `npm run typecheck` remains the strict type gate.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'src/db/migrations/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    rules: {
      // Plan §11: no `any` in new code.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      // Express namespace augmentation (req.user etc.) needs `declare global { namespace Express }`.
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
      'no-console': 'off',
      // Sanitizers strip CR/LF and control characters on purpose (email templates, logs).
      'no-control-regex': 'off',
    },
  },
  {
    files: ['**/*.test.ts', 'src/tests/**/*.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  }
);
