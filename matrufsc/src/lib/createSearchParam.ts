import { createSignal, onCleanup } from "solid-js";

export function createSearchParam(key: string) {
    const read = () => new URLSearchParams(window.location.search).get(key) ?? "";

    const [value, setValue] = createSignal(read());

    const onPopState = () => setValue(read());
    window.addEventListener("popstate", onPopState);
    onCleanup(() => window.removeEventListener("popstate", onPopState));

    const update = (next: string, options: { replace?: boolean } = {}) => {
        const url = new URL(window.location.href);

        if (next) url.searchParams.set(key, next);
        else url.searchParams.delete(key);

        // Replacing keeps the entry's state, which marks an open sheet (see layerHistory).
        if (options.replace) history.replaceState(history.state, "", url);
        else history.pushState(null, "", url);

        setValue(next);
    };

    return [value, update] as const;
}
