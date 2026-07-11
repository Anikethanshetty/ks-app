module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // NOTE: the react-native-reanimated/worklets babel plugin is added in Phase 5
    // when the mic animations land; the scaffold has no worklets yet.
  };
};
