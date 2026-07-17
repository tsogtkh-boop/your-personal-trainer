// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Bundle demo exercise videos as assets.
if (!config.resolver.assetExts.includes('webm')) {
  config.resolver.assetExts.push('webm');
}

module.exports = config;
