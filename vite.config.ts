import { crx } from "@crxjs/vite-plugin";
import { defineConfig } from "vite";

import manifest from "./manifest";

export default defineConfig({
    plugins: [crx({ manifest })],
    server: {
        cors: true,
    },
    build: {
        outDir: "dist",
        emptyOutDir: true,
        sourcemap: false,
    },
});
