import clsx from "clsx";
import { For, Show } from "solid-js";
import { usePlano, type Materia, type Turma } from "~/context/plano/Plano.store";
import { usePreferences } from "~/context/preferences/Preferences.store";
import { useHorariosOverlay } from "../horarios/useHorariosOverlay";

export default function Materias(props: { class?: string }) {
    const {
        materias,
        removeMateria,
        moveMateria,
        updateMateriaSelected,
        focusedMateriaId,
        setFocusedMateriaId,
        currentPlano,
        displayedTurma,
    } = usePlano();
    const { overlayMateria, clearOverlay } = useHorariosOverlay();

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

    const handleMove = (id: string, direction: "up" | "down") => {
        clearOverlay();
        moveMateria(id, direction);
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
                    <table class="min-w-full table-fixed divide-y divide-neutral-400">
                        <MateriasTableHead creditos={creditos()} />

                        <tbody class="divide-y divide-neutral-400">
                            <For each={materias}>
                                {(materia, index) => (
                                    <MateriaRow
                                        materia={materia}
                                        turmaSelecionada={displayedTurma(materia.id)}
                                        onClickRemove={handleRemove}
                                        onClickMove={handleMove}
                                        onToggleSelection={handleToggleSelection}
                                        onClickSelect={handleSelectMateria}
                                        onMouseEnter={() => overlayMateria(materia)}
                                        onMouseLeave={clearOverlay}
                                        isSelected={focusedMateriaId() === materia.id}
                                        isFirst={index() === 0}
                                        isLast={index() === materias.length - 1}
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
    const { showDetails } = usePreferences();
    return (
        <thead class="relative bg-neutral-100">
            <tr class="divide-x divide-neutral-400">
                <th class="h-7 w-10 px-3 py-1.5 text-left font-normal text-neutral-700 select-none"></th>
                <th class="col-span-2 h-7 w-24 px-3 py-1.5 text-left font-normal text-neutral-700">Código</th>
                <th
                    class={clsx(
                        "hidden h-7 w-20 px-3 py-1.5 text-left font-normal text-neutral-700",
                        showDetails() && "md:table-cell",
                    )}
                >
                    Turma
                </th>
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
    turmaSelecionada: Turma | null;
    onToggleSelection: (id: string, currentSelected: boolean) => void;
    onClickRemove: (id: string) => void;
    onClickMove: (id: string, direction: "up" | "down") => void;
    onClickSelect: (id: string) => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    isSelected?: boolean;
    isFirst?: boolean;
    isLast?: boolean;
}) {
    const { showDetails } = usePreferences();
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
            <td class={clsx("hidden px-3 py-1.5 whitespace-nowrap", showDetails() && "md:table-cell")}>
                {props.turmaSelecionada ? props.turmaSelecionada.id : "—"}
            </td>
            <td class="relative px-3 py-1.5">
                <span>{props.materia.nome}</span>
                <div class="absolute top-1/2 right-0 flex -translate-y-1/2 items-stretch opacity-0 select-none group-hover:opacity-100">
                    <button
                        type="button"
                        aria-label="Mover matéria para cima"
                        disabled={props.isFirst}
                        class={clsx(
                            "disabled:cursor-default disabled:no-underline disabled:opacity-30",
                            "flex cursor-pointer items-center px-1.5 py-1.5 underline-offset-1 hover:underline",
                        )}
                        onClick={(e) => {
                            e.stopPropagation();
                            props.onClickMove(props.materia.id, "up");
                        }}
                    >
                        ↑
                    </button>
                    <button
                        type="button"
                        aria-label="Mover matéria para baixo"
                        disabled={props.isLast}
                        class={clsx(
                            "disabled:cursor-default disabled:no-underline disabled:opacity-30",
                            "flex cursor-pointer items-center px-1.5 py-1.5 underline-offset-1 hover:underline",
                        )}
                        onClick={(e) => {
                            e.stopPropagation();
                            props.onClickMove(props.materia.id, "down");
                        }}
                    >
                        ↓
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
                        ×
                    </button>
                </div>
            </td>
        </tr>
    );
}
