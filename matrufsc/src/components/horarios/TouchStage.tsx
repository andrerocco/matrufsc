import clsx from "clsx";
import { createEffect, on, onCleanup, Show } from "solid-js";
import { usePlano } from "~/context/plano/Plano.store";
import Footer from "~/components/footer/Footer";
import { ExportOptions } from "~/components/header/Header";
import MateriasList from "~/components/materias/MateriasList";
import TurmasSheet from "~/components/turmas/TurmasSheet";
import { isPhone, smallHeight } from "~/lib/media";
import CombinacaoSpinner from "./CombinacaoSpinner";
import Horarios, { stagedHeight } from "./Horarios";

// The same column as the header and the search.
const COLUMN = "px-safe-4 sm:px-safe-6 mx-auto w-full max-w-[1000px]";

const GAP = 7;

// `onLift` is how far the page must move up for the grid to meet the screen's top while the turmas are open:
// under a sheet the page cannot scroll.
export default function TouchStage(props: { onLift: (px: number) => void }) {
    const { materias, focusedMateriaId } = usePlano();

    let stageRef!: HTMLDivElement;

    // A part of the screen, so that a sheet under the grid leaves the whole week in sight. Of the smallest window,
    // or the grid would change size as the browser's bars hide.
    const stage = () => Math.round(Math.min(smallHeight() * 0.55, 432)) - 2 * GAP;
    // Not from `getBoundingClientRect`, which would count a lift still easing back.
    const stageTop = () => {
        let top = -window.scrollY;
        for (let element: HTMLElement | null = stageRef; element; element = element.offsetParent as HTMLElement | null)
            top += element.offsetTop;
        return top;
    };

    createEffect(
        on(
            () => focusedMateriaId() !== null,
            (open) => props.onLift(open ? stageTop() : 0),
        ),
    );
    onCleanup(() => props.onLift(0));

    return (
        <div class="flex flex-1 flex-col">
            {/* Past a phone's width the grid's columns stop growing, and the actions keep to its edges */}
            <div class={clsx("mx-auto max-w-full shrink-0", isPhone() ? "w-full" : "w-max")}>
                <div ref={stageRef} style={{ "padding-top": `${GAP}px` }}>
                    {/* The column's padding inside the grid's scroller, which a grid too wide for the screen then
                        scrolls in from edge to edge */}
                    <Horarios class="px-safe-4 sm:px-safe-6" stage={stage()} />
                </div>
                <div
                    class={clsx(COLUMN, "group flex items-center")}
                    style={{ "padding-top": `${GAP}px`, "padding-bottom": `${GAP}px` }}
                >
                    <div class="group-has-[[data-export-open]]:hidden">
                        <CombinacaoSpinner />
                    </div>
                    <Show when={materias.length > 0}>
                        <div class="ml-auto">
                            <ExportOptions />
                        </div>
                    </Show>
                </div>
            </div>
            <div class={COLUMN}>
                <MateriasList />
            </div>
            <Footer class={clsx(COLUMN, "mt-auto pt-6 pb-[calc(1rem+env(safe-area-inset-bottom))] text-[11px]")} />
            <TurmasSheet line={GAP + stagedHeight(stage()) + GAP} />
        </div>
    );
}
