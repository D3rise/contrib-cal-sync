import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', '.test-dist/**', 'node_modules/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parserOptions: { project: ['./tsconfig.json', './tsconfig.test.json'] }
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': 'off'
    }
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{
        group: ['**/application/**', '**/infrastructure/**', '**/presentation/**', '**/composition/**', 'inversify'],
        message: 'Domain code may depend only on domain code and the platform.'
      }] }]
    }
  },
  {
    files: ['src/application/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{
        group: ['**/infrastructure/**', '**/presentation/**', '**/composition/**', 'inversify'],
        message: 'Application code may depend only on domain code and application-owned contracts.'
      }] }]
    }
  },
  {
    files: ['src/infrastructure/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{
        group: ['**/presentation/**', '**/composition/**', 'inversify'],
        message: 'Infrastructure adapters must not depend on delivery or composition code.'
      }] }]
    }
  },
  {
    files: ['src/presentation/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{
        group: ['**/infrastructure/**', '**/composition/**', 'inversify'],
        message: 'Presentation code may use application interfaces but not infrastructure implementations.'
      }] }]
    }
  }
)
