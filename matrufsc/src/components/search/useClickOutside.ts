import { RefObject, useEffect } from "react";

/**
 * Hook for detecting clicks outside of a specified element
 * @param ref - Reference to the element to check clicks against
 * @param handler - Callback function to execute when a click outside occurs
 * @param enabled - Whether the hook should be active (defaults to true)
 */
export function useClickOutside<T extends HTMLElement = HTMLElement>(
    ref: RefObject<T | null>,
    handler: () => void,
    enabled: boolean = true,
): void {
    useEffect(() => {
        if (!enabled) return;

        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                // Use setTimeout to ensure the original click event completes first
                setTimeout(() => {
                    handler();
                }, 0);
            }
        };

        // Use mouseup and touchend instead of mousedown and touchstart
        // Ensures the original click events are processed first
        document.addEventListener("mouseup", handleClickOutside);
        document.addEventListener("touchend", handleClickOutside);

        // Clean up the event listeners
        return () => {
            document.removeEventListener("mouseup", handleClickOutside);
            document.removeEventListener("touchend", handleClickOutside);
        };
    }, [ref, handler, enabled]);
}
