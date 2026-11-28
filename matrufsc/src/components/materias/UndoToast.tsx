import { createSignal, Show } from "solid-js";
import { usePlano } from "~/context/plano/Plano.store";

const UNDO_MS = 6000;

const [removed, setRemoved] = createSignal<{ id: string; restore: () => void }>();
let timeoutId: number | undefined;

export function removeWithUndo(id: string) {
    const restore = usePlano().removeMateria(id);
    window.clearTimeout(timeoutId);
    setRemoved({ id, restore });
    timeoutId = window.setTimeout(() => setRemoved(undefined), UNDO_MS);
}

export default function UndoToast() {
    const undo = (restore: () => void) => {
        window.clearTimeout(timeoutId);
        setRemoved(undefined);
        restore();
    };

    return (
        <Show when={removed()}>
            {(removed) => (
                <div class="pointer-events-none fixed inset-x-0 bottom-0 z-60 flex justify-center pb-[calc(1rem+env(safe-area-inset-bottom))]">
                    <div
                        role="status"
                        class="pointer-events-auto flex items-center gap-2 rounded-md bg-neutral-800 pl-4 text-white"
                    >
                        <span>{removed().id} removida</span>
                        <button
                            class="h-[44px] cursor-pointer px-4 text-blue-300 underline"
                            onClick={() => undo(removed().restore)}
                        >
                            Desfazer
                        </button>
                    </div>
                </div>
            )}
        </Show>
    );
}
