/* @refresh reload */
import { render } from "solid-js/web";
import "./index.css";
import App from "./App.tsx";
import { ImageExportProvider } from "./components/export/ImageExport.tsx";
import { UrlStateProvider } from "./context/url/UrlState.tsx";

const root = document.getElementById("root");

render(
    () => (
        <ImageExportProvider>
            <UrlStateProvider>
                <App />
            </UrlStateProvider>
        </ImageExportProvider>
    ),
    root!,
);
