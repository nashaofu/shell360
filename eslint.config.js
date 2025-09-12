import js from '@eslint/js';
import ts from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default ts.config(
  {
    ignores: [
      '**/dist/',
      '**/dist-js/',
      'target/',
      'src-tauri',
      '*/ios',
      '*/android',
    ],
  },
  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,jsx,tsx}'],
    extends: [js.configs.recommended, ...ts.configs.recommended],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      quotes: ['error', 'single', { avoidEscape: true }],
      'no-console': 'warn',
      'no-trailing-spaces': [
        'error',
        {
          skipBlankLines: false,
          ignoreComments: false,
        },
      ],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      importPlugin.flatConfigs.recommended,
      importPlugin.flatConfigs.typescript,
    ],
    rules: {
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'unknown',
          ],
          pathGroups: [
            {
              pattern: '@/**',
              group: 'internal',
            },
            {
              pattern: './*.scss',
              group: 'unknown',
            },
          ],
          'newlines-between': 'always',
        },
      ],
      'import/no-unresolved': 'off',
    },
  }
);
