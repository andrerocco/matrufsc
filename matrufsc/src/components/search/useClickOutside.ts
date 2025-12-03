import { onCleanup, onMount, type Accessor } from "solid-js";

/**
 * Hook for detecting clicks outside of a specified element
 * @param ref - Accessor to the element to check clicks against
 * @param handler - Callback function to execute when a click outside occurs
 * @param enabled - Accessor or boolean for whether the hook should be active
 */
export function useClickOutside(
    ref: Accessor<HTMLElement | undefined>,
    handler: () => void,
    enabled: Accessor<boolean> | boolean = true,
): void {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
        const isEnabled = typeof enabled === "function" ? enabled() : enabled;
        if (!isEnabled) return;

        const element = ref();
        if (element && !element.contains(event.target as Node)) {
            // Use setTimeout to ensure the original click event completes first
            setTimeout(() => {
                handler();
            }, 0);
        }
    };

    onMount(() => {
        document.addEventListener("click", handleClickOutside);
    });

    onCleanup(() => {
        document.removeEventListener("click", handleClickOutside);
    });
}
