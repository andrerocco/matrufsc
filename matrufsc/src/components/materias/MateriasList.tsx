import { For, onCleanup, Show } from "solid-js";
import GripVertical from "lucide-solid/icons/grip-vertical";
import { usePlano } from "~/context/plano/Plano.store";
import { materiaNome } from "~/lib/nomeCompleto";
import { dragRow } from "./dragRow";
import { getPlanoCreditos } from "./Materias";
import { swipeRows } from "./swipeRows";
import { removeWithUndo } from "./UndoToast";

export default function MateriasList() {
    const { materias, currentPlano, reorderMateria, updateMateriaSelected, setFocusedMateriaId } = usePlano();

    let listRef: HTMLDivElement | undefined;

    const handleDrag = (event: PointerEvent, index: number) => {
        const { id } = materias[index];
        dragRow(event, [...listRef!.children] as HTMLElement[], index, (to) => reorderMateria(id, to));
    };

    const handleKeyDown = (event: KeyboardEvent & { currentTarget: HTMLElement }, index: number) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        reorderMateria(materias[index].id, index + (event.key === "ArrowUp" ? -1 : 1));
        event.currentTarget.focus();
    };

    return (
        <Show when={materias.length > 0}>
            <div class="overflow-hidden rounded-md border border-neutral-400">
                <div class="flex h-7 items-center justify-between border-b border-neutral-400 bg-neutral-100 px-3 text-neutral-700">
                    <span>Matérias</span>
                    <span class="text-sm text-neutral-400">Créditos: {getPlanoCreditos(currentPlano() ?? [])}</span>
                </div>
                <div
                    ref={(list) => {
                        listRef = list;
                        onCleanup(swipeRows(list, (row) => removeWithUndo(row.dataset.materiaId!)));
                    }}
                    class="touch-pan-y touch-pinch-zoom *:border-neutral-400 *:not-last:border-b"
                >
                    <For each={materias}>
                        {(materia, index) => (
                            <div
                                data-materia-id={materia.id}
                                class="materia-item group relative flex min-h-[36px] cursor-pointer data-dragging:border-transparent"
                                style={{ "background-color": materia.cor }}
                                onClick={() => setFocusedMateriaId(materia.id)}
                            >
                                <label
                                    class="flex w-[40px] shrink-0 cursor-pointer items-center justify-center"
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    <input
                                        type="checkbox"
                                        checked={materia.selected}
                                        disabled={materia.blocked}
                                        title={materia.blocked ? "Conflito com matéria(s) acima na lista" : ""}
                                        onChange={() => updateMateriaSelected(materia.id, !materia.selected)}
                                        class="size-[15px] cursor-pointer"
                                    />
                                </label>
                                <p class="min-w-0 flex-1 self-center py-1.5 break-words">
                                    <span class="mr-[1ch]">{materia.id}</span>
                                    {materiaNome(materia)}
                                </p>
                                <button
                                    type="button"
                                    aria-label="Reordenar matéria"
                                    class="flex w-[40px] shrink-0 cursor-grab items-center justify-center text-black/50 select-none active:cursor-grabbing"
                                    onPointerDown={(event) => handleDrag(event, index())}
                                    onKeyDown={(event) => handleKeyDown(event, index())}
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    <GripVertical size="1.25em" strokeWidth={1.75} aria-hidden="true" />
                                </button>
                                {/* What a swipe to the left uncovers: `--swipe` wide, with the label 37px in once
                                    the swipe is long enough to remove the row, where it sits when the action is
                                    open. */}
                                <div
                                    aria-hidden="true"
                                    class="absolute top-0 -bottom-px left-full w-[var(--swipe,0px)] overflow-hidden bg-neutral-100 text-red-600 underline underline-offset-2 shadow-[inset_1px_-1px_0_var(--color-neutral-400)]"
                                >
                                    <span class="absolute top-1/2 left-1/2 -translate-1/2 transition-[left] duration-150 group-data-swipe-full:left-[37px]">
                                        Remover
                                    </span>
                                </div>
                            </div>
                        )}
                    </For>
                </div>
            </div>
        </Show>
    );
}
