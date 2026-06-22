import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules', '**/dist', 'scripts/**', 'docs/**'] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  eslintConfigPrettier
);
