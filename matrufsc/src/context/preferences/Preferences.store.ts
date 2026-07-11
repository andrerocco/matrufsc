import { createSignal } from "solid-js";

const [showDetails, setShowDetails] = createSignal(false);

export const usePreferences = () => ({ showDetails, setShowDetails });
