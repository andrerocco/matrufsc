import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import { visualizer } from "rollup-plugin-visualizer";
import path from "path";

export default defineConfig({
    plugins: [solid(), tailwindcss(), visualizer()],
    resolve: {
        alias: {
            "~": path.resolve(__dirname, "src"),
        },
    },
});
