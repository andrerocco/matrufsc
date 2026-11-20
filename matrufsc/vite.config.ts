import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import { visualizer } from "rollup-plugin-visualizer";
import path from "path";

export default defineConfig({
    plugins: [solid(), tailwindcss(), visualizer()],
    base: process.env.VITE_BASE_URL ?? "/",
    build: {
        rollupOptions: {
            input: [path.resolve(__dirname, "index.html"), path.resolve(__dirname, "sobre.html")],
        },
    },
    resolve: {
        alias: {
            "~": path.resolve(__dirname, "src"),
        },
    },
});
