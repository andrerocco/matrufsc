import clsx from "clsx";
import { createEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";

// What the turmas table leaves off a turma's line shows in a tip over the page, pointing at the turma's id.
export type Note = { label: string; value: string };
type Tip = { turmaId: string; notes: Note[]; anchor: DOMRect };
export const [tip, setTip] = createSignal<Tip | null>(null);

const GAP = 6;
const MARGIN = 8;

export function TurmaTip() {
    const close = () => setTip(null);

    // The tip is fixed to the screen, so a scroll would leave it behind its turma.
    onMount(() => {
        window.addEventListener("scroll", close, true);
        window.addEventListener("resize", close);
    });
    onCleanup(() => {
        window.removeEventListener("scroll", close, true);
        window.removeEventListener("resize", close);
        close();
    });

    return (
        <Show when={tip()}>
            {(shown) => (
                <Portal>
                    <TurmaTipBox tip={shown()} />
                </Portal>
            )}
        </Show>
    );
}

function TurmaTipBox(props: { tip: Tip }) {
    let box!: HTMLDivElement;
    const [place, setPlace] = createSignal({ left: 0, top: 0, arrow: 0, below: false });

    // Centred under the id, pushed back inside the screen, and over the id when there is no room below.
    createEffect(() => {
        const { anchor } = props.tip;
        const { width, height } = box.getBoundingClientRect();
        const center = anchor.left + anchor.width / 2;
        const left = Math.max(MARGIN, Math.min(center - width / 2, window.innerWidth - width - MARGIN));
        const below = anchor.bottom + GAP + height <= window.innerHeight - MARGIN;
        setPlace({ left, top: below ? anchor.bottom + GAP : anchor.top - GAP - height, arrow: center - left, below });
    });

    return (
        <div
            ref={box}
            class="pointer-events-none fixed z-50 max-w-[calc(100vw-1rem)] rounded-md border border-neutral-400 bg-white px-2 py-0.5 text-[0.85rem] leading-5"
            style={{ left: `${place().left}px`, top: `${place().top}px` }}
        >
            <span
                class={clsx(
                    "absolute size-2 -translate-x-1/2 rotate-45 border-neutral-400 bg-white",
                    place().below ? "-top-[5px] border-t border-l" : "-bottom-[5px] border-r border-b",
                )}
                style={{ left: `${place().arrow}px` }}
            />
            <dl class="grid grid-cols-[auto_1fr] gap-x-2">
                <For each={props.tip.notes}>
                    {(note) => (
                        <>
                            <dt class="text-neutral-500">{note.label}</dt>
                            <dd>{note.value}</dd>
                        </>
                    )}
                </For>
            </dl>
        </div>
    );
}
