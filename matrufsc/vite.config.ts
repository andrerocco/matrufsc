import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { visualizer } from "rollup-plugin-visualizer";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss(), visualizer({ open: true })],
    resolve: {
        /* Aliases (also change tsconfig.app.json) */
        alias: {
            "~": path.resolve(__dirname, "src"),
        },
    },
    base: "/matrufsc/",
});
