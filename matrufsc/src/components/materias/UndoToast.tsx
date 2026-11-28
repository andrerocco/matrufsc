import { createSignal, Show } from "solid-js";
import { usePlano } from "~/context/plano/Plano.store";
import Toast from "~/components/toast/Toast";

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
                <Toast>
                    <span>{removed().id} removida</span>
                    <button
                        class="h-[44px] cursor-pointer px-4 text-blue-300 underline"
                        onClick={() => undo(removed().restore)}
                    >
                        Desfazer
                    </button>
                </Toast>
            )}
        </Show>
    );
}
