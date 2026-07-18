// Let TypeScript treat bundled .tflite models as asset refs (Metro returns a
// numeric asset id for these, which react-native-fast-tflite accepts).
declare module '*.tflite' {
  const asset: number;
  export default asset;
}
