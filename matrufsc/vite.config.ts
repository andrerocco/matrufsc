import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
// Plugins
import { visualizer } from "rollup-plugin-visualizer";

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), visualizer({ open: true })],
    resolve: {
        /* Aliases (also change tsconfig.app.json) */
        alias: {
            "~": path.resolve(__dirname, "src"),
        },
    },
    base: "/matrufsc/",
});
