import clsx from "clsx";
import { createEffect, createMemo, createSignal, For, on, onCleanup, Show } from "solid-js";
import Trash from "lucide-solid/icons/trash";
import { mergeEquivalentTurmas } from "~/context/plano/combinacoes";
import { usePlano } from "~/context/plano/Plano.store";
import type { Materia, Turma } from "~/data/types";
import Sheet, { type SheetHandle } from "~/components/sheet/Sheet";
import { viewport } from "~/lib/media";
import { useHorariosOverlay } from "../horarios/useHorariosOverlay";
import { removeWithUndo } from "../materias/UndoToast";
import { hasManyCursos, isUnavailable, showsCurso, TurmaVagas } from "./Turmas";

// Less room than this under the grid, as on a phone on its side, and the sheet opens at full height instead.
const MIN_REST = 160;

// `line` is where the sheet rests, in px from the screen's top: right under the grid, so that the turma a tap
// previews stays in sight.
export default function TurmasSheet(props: { line: number }) {
    const { materias, focusedMateriaId, setFocusedMateriaId, updateTurmasSelected } = usePlano();
    const { overlayTurma, clearOverlay } = useHorariosOverlay();

    let sheet: SheetHandle | undefined;

    const rest = () => {
        const room = viewport().height - props.line;
        return room >= MIN_REST ? room : undefined;
    };

    const focused = () => materias.find((materia) => materia.id === focusedMateriaId());
    // Still there while the sheet slides away, after the materia lost focus or was removed.
    const materia = createMemo<Materia | undefined>((last) => focused() ?? last);

    // The first turma's id of the group a tap is previewing on the grid.
    const [previewed, setPreviewed] = createSignal<string>();

    const stopPreview = () => {
        setPreviewed(undefined);
        clearOverlay();
    };
    createEffect(on(focusedMateriaId, stopPreview, { defer: true }));
    onCleanup(stopPreview);

    const handleTap = (turmas: Turma[], card: HTMLElement) => {
        if (previewed() === turmas[0].id) return stopPreview();
        setPreviewed(turmas[0].id);
        overlayTurma(materia()!.id, turmas.find((turma) => turma.selected) ?? turmas[0]);
        sheet?.rest();
        requestAnimationFrame(() => card.scrollIntoView({ block: "nearest", behavior: "smooth" }));
    };

    return (
        <Sheet
            ref={(handle) => (sheet = handle)}
            open={focused() !== undefined}
            onClose={() => setFocusedMateriaId(null)}
            label={`Turmas de ${materia()?.id}`}
            rest={rest()}
            bare
            header={
                <div class="flex h-[40px] items-center gap-2.5 pt-[10px] pl-4">
                    <span
                        class="shrink-0 rounded-sm border border-neutral-500/80 px-1.5 leading-[20px]"
                        style={{ "background-color": materia()?.cor }}
                    >
                        {materia()?.id}
                    </span>
                    <p class="min-w-0 flex-1 truncate text-neutral-600">{materia()?.nome}</p>
                    <button
                        aria-label="Remover matéria"
                        class="-mt-[10px] flex w-[44px] shrink-0 cursor-pointer items-center justify-center self-stretch pt-1 text-[16px] text-neutral-700"
                        onClick={() => removeWithUndo(materia()!.id)}
                    >
                        <Trash size="1.25em" strokeWidth={1.75} aria-hidden="true" />
                    </button>
                </div>
            }
        >
            <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-neutral-400 pb-[env(safe-area-inset-bottom)]">
                <Show when={materia()}>
                    {(materia) => (
                        <For
                            each={Object.values(mergeEquivalentTurmas(materia().turmas))}
                            fallback={
                                <p class="bg-neutral-100 px-4 py-3 text-center text-neutral-500">
                                    Nenhuma turma disponível para esta matéria.
                                </p>
                            }
                        >
                            {(turmas) => (
                                <TurmaCard
                                    turmas={turmas}
                                    color={materia().cor}
                                    showCurso={hasManyCursos(materia())}
                                    previewing={previewed() === turmas[0].id}
                                    onToggleTurmas={(ids, value) => updateTurmasSelected(materia().id, ids, value)}
                                    onTap={(card) => handleTap(turmas, card)}
                                />
                            )}
                        </For>
                    )}
                </Show>
            </div>
        </Sheet>
    );
}

// The table leaves a turma's curso and status to a tip; here each has a line, in the notation of the CAGR.
function TurmaCard(props: {
    turmas: Turma[];
    color?: string;
    showCurso: boolean;
    previewing: boolean;
    onToggleTurmas: (turmaIds: string[], value: boolean) => void;
    onTap: (card: HTMLElement) => void;
}) {
    return (
        <div
            class={clsx(
                "turma-item cursor-pointer border-b border-neutral-400 bg-white",
                props.previewing && "bg-linear-to-b from-black/15 to-black/15",
            )}
            style={{ "background-color": props.color }}
            onClick={(event) => props.onTap(event.currentTarget)}
        >
            <For each={props.turmas}>
                {(turma) => (
                    <div class="flex">
                        <label
                            class="flex w-[44px] shrink-0 cursor-pointer justify-center pt-[12.5px]"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <input
                                type="checkbox"
                                checked={turma.selected}
                                onChange={(event) => props.onToggleTurmas([turma.id], event.currentTarget.checked)}
                                class="size-[15px] cursor-pointer"
                            />
                        </label>
                        <div class="min-w-0 flex-1 py-2.5 pr-4">
                            <div class={clsx(isUnavailable(turma) && "opacity-50")}>
                                <div class="flex justify-between gap-3">
                                    <span class={clsx(isUnavailable(turma) && "line-through")}>{turma.id}</span>
                                    <TurmaVagas turma={turma} />
                                </div>
                                <For each={turma.professores} fallback={<p class="opacity-60">---</p>}>
                                    {(professor) => <p class="break-words">{professor}</p>}
                                </For>
                            </div>
                            <Show when={showsCurso(turma, props.showCurso)}>
                                <p class="break-words opacity-60">{`*${turma.curso.nome}`}</p>
                            </Show>
                            <Show when={turma.status}>
                                <p class="break-words opacity-60">{`[${turma.status}]`}</p>
                            </Show>
                        </div>
                    </div>
                )}
            </For>
        </div>
    );
}
