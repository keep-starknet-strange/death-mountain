// Polyfills required by some web/node-oriented deps (e.g. starknet) when running in React Native.
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import { Buffer } from "buffer";
import process from "process";
import { TextDecoder, TextEncoder } from "fast-text-encoding";

globalThis.Buffer = globalThis.Buffer ?? Buffer;
globalThis.process = globalThis.process ?? process;
globalThis.TextEncoder = globalThis.TextEncoder ?? TextEncoder;
globalThis.TextDecoder = globalThis.TextDecoder ?? TextDecoder;

import { registerRootComponent } from "expo";
import App from "./src/App";

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
