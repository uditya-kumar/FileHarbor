// https://docs.expo.dev/guides/using-eslint/
// React Compiler rules come from eslint-plugin-react-hooks v7 inside eslint-config-expo.
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "android/*", "ios/*"],
  },
]);
