import esLint from '@eslint/js';
import esPrettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import tsEsLint from 'typescript-eslint';

export default defineConfig(
  // JavaScript
  esLint.configs.recommended,
  // TypeScript
  tsEsLint.configs.strictTypeChecked,
  tsEsLint.configs.stylisticTypeChecked,
  // Prettier
  esPrettier,
  // Custom config
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: false,
        },
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/strict-boolean-expressions': [
        2,
        {
          allowString: true,
          allowNumber: true,
          allowNullableObject: true,
          allowNullableBoolean: true,
        },
      ],
      '@typescript-eslint/restrict-template-expressions': [
        2,
        {
          allowBoolean: true,
          allowNullish: true,
          allowNumber: true,
          allowRegExp: true,
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: false,
        },
      ],
      '@typescript-eslint/no-confusing-void-expression': [
        'error',
        {
          ignoreArrowShorthand: true,
        },
      ],
      '@typescript-eslint/array-type': [
        'error',
        {
          default: 'array-simple',
          readonly: 'array-simple',
        },
      ],
      '@typescript-eslint/restrict-plus-operands': [
        'error',
        {
          allowNumberAndString: true,
        },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
    },
  },
  { files: ['**/*.ts'] },
  { ignores: ['**/*.js', '**/*.cjs', '**/*.mjs'] },
);
