const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const pkg = require('../package.json');

const root = path.resolve(__dirname, '..');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = getDefaultConfig(__dirname);

// Use the library source on every platform, including web, during development.
config.resolver.resolveRequest = (context, moduleName, platform) =>
  context.resolveRequest(
    context,
    moduleName === pkg.name ? path.resolve(root, pkg.source) : moduleName,
    platform
  );

module.exports = config;
