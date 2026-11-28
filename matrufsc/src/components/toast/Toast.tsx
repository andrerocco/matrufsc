import type { JSXElement } from "solid-js";

export default function Toast(props: { children: JSXElement }) {
    return (
        <div class="pointer-events-none fixed inset-x-0 bottom-0 z-60 flex justify-center px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div
                role="status"
                class="pointer-events-auto flex items-center gap-2 rounded-md bg-neutral-800 pl-4 text-white"
            >
                {props.children}
            </div>
        </div>
    );
}
