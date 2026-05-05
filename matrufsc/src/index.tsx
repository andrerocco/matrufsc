/* @refresh reload */
import { render } from "solid-js/web";
import "./index.css";
import App from "./App.tsx";
import MetaTitle from "./components/meta-title/MetaTitle.tsx";
// Context
import { ImageExportProvider } from "~/context/image-export/ImageExport.tsx";
import { UrlStateProvider } from "~/context/url/UrlState.tsx";

const root = document.getElementById("root");

render(
    () => (
        <ImageExportProvider>
            <UrlStateProvider>
                <MetaTitle />
                <App />
            </UrlStateProvider>
        </ImageExportProvider>
    ),
    root!,
);
