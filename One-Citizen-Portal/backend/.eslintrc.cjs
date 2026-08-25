/* Backend ESLint — enforces the layered architecture boundary:
   controllers must NEVER touch persistence or fs (Architecture §2.3, backend/ARCHITECTURE.md §1).
   Access to data is only via repositories, reached through services. */
module.exports = {
  root: true,
  env: { node: true, es2022: true },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  extends: ['eslint:recommended'],
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
  },
  ignorePatterns: ['node_modules/', 'coverage/'],
  overrides: [
    {
      // Controllers: no persistence, no direct fs, no repository imports.
      files: ['src/**/*.controller.js'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              { group: ['**/repositories/*', '**/repositories/**'], message: 'Controllers must not import repositories. Call a service.' },
              { group: ['fs', 'node:fs', 'fs/promises', 'node:fs/promises'], message: 'Controllers must not touch the filesystem. Data access lives in repositories.' },
            ],
          },
        ],
      },
    },
    {
      // Services: business logic only — no HTTP, no direct fs.
      files: ['src/**/*.service.js'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              { group: ['express'], message: 'Services must not depend on Express (no req/res). Keep HTTP in controllers.' },
              { group: ['fs', 'node:fs', 'fs/promises', 'node:fs/promises'], message: 'Services must not touch the filesystem. Use a repository.' },
            ],
          },
        ],
      },
    },
    {
      files: ['**/*.test.js'],
      env: { node: true },
    },
  ],
};
