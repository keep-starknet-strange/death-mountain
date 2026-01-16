import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";

// https://vitejs.dev/config/
export default defineConfig({
    // Disable mkcert for native shell development (iOS simulator doesn't trust self-signed certs)
    // Re-enable for production builds
    plugins: [react(), wasm(), topLevelAwait(), /* mkcert() */],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});
