import { scan } from "react-scan";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
// Providers
import { TurmasListProvider } from "./components/turmas/Turmas";

if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
    scan({
        enabled: true,
        // log: true, // logs render info to console (default: false)
    });
}

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <TurmasListProvider>
            <App />
        </TurmasListProvider>
    </StrictMode>,
);
