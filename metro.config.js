// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Bundle demo exercise videos as assets.
if (!config.resolver.assetExts.includes('webm')) {
  config.resolver.assetExts.push('webm');
}

// Bundle TensorFlow Lite pose models as binary assets (native camera coaching).
if (!config.resolver.assetExts.includes('tflite')) {
  config.resolver.assetExts.push('tflite');
}

module.exports = config;
