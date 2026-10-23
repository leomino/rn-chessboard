const { fixupConfigRules } = require('@eslint/compat');
const reactNative = require('@react-native/eslint-config/flat');
const prettier = require('eslint-plugin-prettier/recommended');

module.exports = [
  {
    ignores: [
      '**/node_modules/**',
      'lib/**',
      '.yarn/**',
      '**/.expo/**',
      'coverage/**',
    ],
  },
  // React Native's Flow plugin still uses the ESLint 8 rule API.
  ...fixupConfigRules(reactNative),
  prettier,
  {
    rules: {
      'react/react-in-jsx-scope': 'off',
    },
  },
];
