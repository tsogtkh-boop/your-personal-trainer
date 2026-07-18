// The react-native-worklets-core plugin compiles the 'worklet'-tagged frame
// processor in CoachCamera.native.tsx so pose detection can run on the camera
// thread. It's a no-op for the web bundle (no worklets there), so this is safe
// for all platforms. Keep it last in the plugins list.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets-core/plugin'],
  };
};
