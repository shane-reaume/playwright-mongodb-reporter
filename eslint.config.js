const typescript = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');
const prettier = require('eslint-config-prettier');
const path = require('path');

module.exports = [
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**'
    ]
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
        tsconfigRootDir: path.resolve(__dirname)
      },
      globals: {
        'process': 'readonly',
        '__dirname': 'readonly',
        'module': 'readonly',
        'require': 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': typescript
    },
    rules: {
      ...typescript.configs.recommended.rules,
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },
  prettier
];