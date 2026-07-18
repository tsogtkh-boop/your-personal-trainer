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

// @tensorflow-models/pose-detection statically imports several detector runtimes
// we never use — we only run its MoveNet model on the WebGL backend. Those
// optional peer deps (MediaPipe, the WASM and WebGPU backends) aren't installed,
// so a production `expo export` fails resolving them (the dev server bundles
// lazily and never hits it). Stub them to empty modules — the code paths that
// reference them are never executed for MoveNet.
const STUBBED_MODULES = new Set([
  '@mediapipe/pose',
  '@tensorflow/tfjs-backend-wasm',
  '@tensorflow/tfjs-backend-webgpu',
]);
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (STUBBED_MODULES.has(moduleName)) {
    return { type: 'empty' };
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
