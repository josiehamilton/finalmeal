import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '.expo/**', 'dist/**', '*.config.js', 'jest.setup.js'] },
  ...tseslint.configs.recommended,
);
