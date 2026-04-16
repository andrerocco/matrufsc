/* @refresh reload */
import { render } from "solid-js/web";
import "./index.css";
import App from "./App.tsx";
import { ImageExportProvider } from "./components/export/ImageExport.tsx";

const root = document.getElementById("root");

render(
    () => (
        <ImageExportProvider>
            <App />
        </ImageExportProvider>
    ),
    root!,
);
