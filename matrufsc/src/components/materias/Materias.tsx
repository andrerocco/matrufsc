import clsx from "clsx";
import { For, Show } from "solid-js";
import { usePlano, type Materia, type Turma } from "~/context/plano/Plano.store";
import { IconClose, IconGrip } from "~/components/icons";
import { dragRow } from "./dragRow";
import { useHorariosOverlay } from "../horarios/useHorariosOverlay";

export default function Materias(props: { class?: string }) {
    const {
        materias,
        removeMateria,
        reorderMateria,
        updateMateriaSelected,
        focusedMateriaId,
        setFocusedMateriaId,
        currentPlano,
    } = usePlano();
    const { overlayMateria, clearOverlay } = useHorariosOverlay();

    let bodyRef: HTMLTableSectionElement | undefined;

    const creditos = () => {
        const plano = currentPlano();
        if (!plano) return 0;
        return getPlanoCreditos(plano);
    };

    const handleRemove = (id: string) => {
        clearOverlay();
        removeMateria(id);
    };

    const handleToggleSelection = (id: string, currentSelected: boolean) => {
        clearOverlay();
        updateMateriaSelected(id, !currentSelected);
    };

    const handleSelectMateria = (id: string) => {
        setFocusedMateriaId((current) => (current === id ? null : id));
    };

    const handleDrag = (event: PointerEvent, index: number) => {
        clearOverlay();
        const { id } = materias[index];
        dragRow(event, [...bodyRef!.children] as HTMLElement[], index, (to) => reorderMateria(id, to));
    };

    return (
        <Show when={materias.length > 0}>
            <div
                class={clsx(
                    "not-prose relative flex overflow-hidden rounded-md border border-neutral-400",
                    props.class,
                )}
            >
                <div class="relative flex-1 overflow-x-auto overflow-y-hidden">
                    <table class="min-w-full table-fixed border-separate border-spacing-0">
                        <MateriasTableHead creditos={creditos()} />

                        <tbody ref={bodyRef} class="*:*:border-t *:*:border-neutral-400">
                            <For each={materias}>
                                {(materia, index) => (
                                    <MateriaRow
                                        materia={materia}
                                        onClickRemove={handleRemove}
                                        onDrag={(event) => handleDrag(event, index())}
                                        onMove={(delta) => reorderMateria(materia.id, index() + delta)}
                                        onToggleSelection={handleToggleSelection}
                                        onClickSelect={handleSelectMateria}
                                        onMouseEnter={() => overlayMateria(materia)}
                                        onMouseLeave={clearOverlay}
                                        isSelected={focusedMateriaId() === materia.id}
                                    />
                                )}
                            </For>
                            {/* <Show when={materias.length === 0}>
                                <tr class="min-h-7 bg-neutral-100">
                                    <td colSpan={3} class="px-3 py-1.5 text-center text-neutral-400">
                                        Nenhuma matéria adicionada.
                                    </td>
                                </tr>
                            </Show> */}
                        </tbody>
                    </table>
                </div>
            </div>
        </Show>
    );
}

function MateriasTableHead(props: { creditos: number }) {
    return (
        <thead class="relative bg-neutral-100">
            <tr class="divide-x divide-neutral-400">
                <th class="h-7 w-10 px-3 py-1.5 text-left font-normal text-neutral-700 select-none"></th>
                <th class="col-span-2 h-7 w-24 px-3 py-1.5 text-left font-normal text-neutral-700">Código</th>
                <th class="h-7 px-3 py-1.5 text-left font-normal text-neutral-700">
                    <div class="flex items-center justify-between">
                        <span>Matéria</span>
                        <span class="text-sm font-normal text-neutral-400 normal-case">Créditos: {props.creditos}</span>
                    </div>
                </th>
            </tr>
        </thead>
    );
}

function getPlanoCreditos(plano: { turma: Turma }[]): number {
    return plano.reduce((total, { turma }) => total + getTurmaCreditos(turma), 0);
}

function getTurmaCreditos(turma: Turma): number {
    return turma.aulas.reduce((total, aula) => total + aula.horarios.length, 0);
}

function MateriaRow(props: {
    materia: Materia;
    onToggleSelection: (id: string, currentSelected: boolean) => void;
    onClickRemove: (id: string) => void;
    onDrag: (event: PointerEvent) => void;
    onMove: (delta: number) => void;
    onClickSelect: (id: string) => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    isSelected?: boolean;
}) {
    const handleKeyDown = (event: KeyboardEvent & { currentTarget: HTMLElement }) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        props.onMove(event.key === "ArrowUp" ? -1 : 1);
        event.currentTarget.focus();
    };

    return (
        <tr
            data-materia-id={props.materia.id}
            data-selected={props.isSelected}
            style={{ "background-color": props.materia.cor }}
            class="materia-item group min-h-7 cursor-pointer divide-x divide-neutral-400"
            onMouseEnter={props.onMouseEnter}
            onMouseLeave={props.onMouseLeave}
            onClick={() => props.onClickSelect(props.materia.id)}
        >
            <td class="px-3 select-none">
                <div class="flex h-full flex-col">
                    <input
                        type="checkbox"
                        checked={props.materia.selected}
                        disabled={props.materia.blocked}
                        title={props.materia.blocked ? "Conflito com matéria(s) acima na lista" : ""}
                        onChange={() => props.onToggleSelection(props.materia.id, props.materia.selected)}
                        onClick={(event) => event.stopPropagation()}
                        class="hit-area-2.75 mr-0 cursor-pointer"
                    />
                </div>
            </td>
            <td class="px-3 py-1.5">{props.materia.id}</td>
            <td class="relative px-3 py-1.5">
                <span>{props.materia.nome}</span>
                <div class="absolute top-1/2 right-0 flex -translate-y-1/2 items-stretch opacity-0 select-none group-hover:opacity-100 group-data-dragging:opacity-100">
                    <button
                        type="button"
                        aria-label="Reordenar matéria"
                        class="pointer-events-none flex cursor-grab touch-none items-center justify-center px-1.5 py-1.5 group-hover:pointer-events-auto active:cursor-grabbing"
                        onPointerDown={props.onDrag}
                        onKeyDown={handleKeyDown}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <IconGrip class="size-[1.125em]" />
                    </button>
                    <button
                        type="button"
                        aria-label="Remover matéria"
                        class="flex cursor-pointer items-center py-1.5 pr-3 pl-1.5 underline-offset-1 hover:underline"
                        onClick={(e) => {
                            e.stopPropagation();
                            props.onClickRemove(props.materia.id);
                        }}
                    >
                        <IconClose class="size-[1em]" />
                    </button>
                </div>
            </td>
        </tr>
    );
}
