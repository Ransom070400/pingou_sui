// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */

const config = getDefaultConfig(__dirname);

// @mysten/sui v2's modular ESM client has a circular dependency
// (transactions -> client/core-resolver -> transactions). With Metro's default
// eager imports, the cycle resolves `BaseClient` to `undefined`, crashing on
// `class SuiJsonRpcClient extends BaseClient` ("Cannot read property 'prototype'
// of undefined"). Deferring requires to first use fixes the init order. (Node/tsx
// tolerate the cycle, which is why the headless smoke tests passed.)
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: true,
    inlineRequires: true,
  },
});

module.exports = withNativeWind(config, { input: './global.css' });
