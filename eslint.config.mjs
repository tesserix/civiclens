import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/**', '.expo/**', '.remember/**', 'dist/**', 'ios/**', 'android/**', 'artifacts/**', 'graft/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended.map(config => ({ ...config, files: ['**/*.ts', '**/*.tsx'] })),
  { files: ['**/*.js', '**/*.cjs', '**/*.mjs'], languageOptions: { globals: { require: 'readonly', module: 'readonly', __dirname: 'readonly', jest: 'readonly', process: 'readonly' } } },
);
