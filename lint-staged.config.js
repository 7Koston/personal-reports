/**
 * @filename: lint-staged.config.js
 * @type {import('lint-staged').Configuration}
 */
export default {
  '*.{js,ts,json}': [() => 'pnpm lint:fix', () => 'pnpm format'],
  '*.{md,yml,yaml,html}': [() => 'pnpm format'],
};
