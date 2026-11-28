import clsx from "clsx";
import { createEffect, createMemo, For, on, Show, type Accessor } from "solid-js";
import { mergeEquivalentTurmas } from "~/context/plano/combinacoes";
import { usePlano } from "~/context/plano/Plano.store";
import type { Materia, Turma } from "~/data/types";
import { useHorariosOverlay } from "../horarios/useHorariosOverlay";
import { setTip, tip, TurmaTip, type Note } from "./TurmaTip";

export default function Turmas(props: { class?: string }) {
    const { materias, focusedMateriaId, setFocusedMateriaId, updateTurmasSelected } = usePlano();
    const { clearOverlay } = useHorariosOverlay();

    const selectedMateria = () => {
        const selectedId = focusedMateriaId();
        return materias.find((materia) => materia.id === selectedId) ?? null;
    };

    // A row swapped out under a still mouse never fires its pointerleave.
    createEffect(on(focusedMateriaId, () => setTip(null)));

    return (
        <Show when={selectedMateria()}>
            {(materia) => (
                <div
                    class={clsx(
                        "not-prose relative my-0.5 flex h-fit w-full overflow-hidden rounded-md border border-neutral-400",
                        props.class,
                    )}
                >
                    <div class="relative flex-1 overflow-x-auto overflow-y-hidden">
                        <table class="min-w-full table-fixed divide-y divide-neutral-400">
                            <TurmasTableHead
                                onClose={() => {
                                    clearOverlay();
                                    setFocusedMateriaId(null);
                                }}
                            />
                            <tbody
                                class="divide-y divide-neutral-400"
                                style={{ "background-color": selectedMateria()?.cor ?? "white" }}
                            >
                                <TurmasTableRows materia={materia} onToggleTurmas={updateTurmasSelected} />
                            </tbody>
                        </table>
                    </div>
                    <TurmaTip />
                </div>
            )}
        </Show>
    );
}

function TurmasTableHead(props: { onClose?: () => void }) {
    return (
        <thead class="relative bg-neutral-100">
            <tr class="h-9 divide-x divide-neutral-400">
                <th>
                    {/* <input
                        type="checkbox"
                        checked
                        class="pointer-events-none mr-0 translate-y-[3px] cursor-pointer opacity-0"
                    /> */}
                </th>
                <th class="w-24 px-3 py-[5px] text-left font-normal text-neutral-700">Turma</th>
                <th class="w-[1%] px-3 py-[5px] text-left font-normal text-neutral-700">Vagas</th>
                <th class="flex w-full items-center justify-between px-3 py-[5px] font-normal">
                    <span class="text-neutral-700">Professores</span>
                    <button
                        class="hit-area-y-1.5 hit-area-x-3 cursor-pointer pr-1 text-lg text-neutral-700 hover:text-black hover:underline"
                        onClick={props.onClose}
                    >
                        —
                    </button>
                </th>
            </tr>
        </thead>
    );
}

function TurmasTableRows(props: {
    materia: Accessor<Materia>;
    onToggleTurmas?: (materiaId: string, turmaIds: string[], value: boolean) => void;
}) {
    const { overlayTurma, clearOverlay } = useHorariosOverlay();

    const materia = props.materia;

    const groupedTurmas = createMemo(() => {
        if (!materia()) return [];

        return Object.values(mergeEquivalentTurmas(materia().turmas));
    });

    // The materia's name carries only the first turma's curso.
    const showCurso = () => new Set(materia().turmas.map((turma) => turma.curso.nome)).size > 1;

    return (
        <For each={groupedTurmas()} fallback={<TurmasEmptyRow message="Nenhuma turma disponível para esta matéria." />}>
            {(turmas) => (
                <TurmaRow
                    id={`turma-${turmas[0].id}`} // Use the first turma's id as the group id
                    turmas={turmas}
                    showCurso={showCurso()}
                    onToggleTurmas={(turmaIds, value) => props.onToggleTurmas?.(materia().id, turmaIds, value)}
                    onMouseEnter={() => {
                        // Select one turma from the group as preview for the overlay
                        const previewTurma = turmas.find((turma) => turma.selected) ?? turmas[0];
                        if (previewTurma) overlayTurma(materia().id, previewTurma);
                    }}
                    onMouseLeave={() => clearOverlay()}
                />
            )}
        </For>
    );
}

function TurmasEmptyRow(props: { message: string }) {
    return (
        <tr class="min-h-9 bg-neutral-100">
            <td colSpan={4} class="px-3 py-2 text-center text-neutral-500">
                {props.message}
            </td>
        </tr>
    );
}

// Every column of a row stacks one cell per turma of the group, and the professores column renders one
// `h-6` line per professor. The columns only line up if each turma's cell is as tall as its own professor
// list, so all of them size their cells with `turmaCellHeight` (an emulated rowspan).
const LINE_HEIGHT_REM = 1.5; // `h-6`
const turmaCellHeight = (turma: Turma) => `${Math.max(1, turma.professores.length) * LINE_HEIGHT_REM}rem`;

// A status shows as a mark on the turma's id: struck through when nobody can take the turma, an asterisk
// for any other status.
const UNAVAILABLE = new Set(["Cancelada", "Bloqueada (inativa)"]);
const isUnavailable = (turma: Turma) => turma.status !== null && UNAVAILABLE.has(turma.status);
const dimmed = (turma: Turma) => isUnavailable(turma) && "opacity-50";

const RESERVADA = "Reservada Curso";

function TurmaRow(props: {
    id: string;
    turmas: Turma[];
    showCurso: boolean;
    onToggleTurmas: (turmaIds: string[], value: boolean) => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
}) {
    const twochars = (n: number) => `${n < 10 ? "\u00A0" : ""}${n}`;

    // A reserved turma is reserved for its curso, so its status is unreadable without it.
    const notes = (turma: Turma): Note[] => [
        ...(turma.status ? [{ label: "Situação", value: turma.status }] : []),
        ...(props.showCurso || turma.status === RESERVADA ? [{ label: "Curso", value: turma.curso.nome }] : []),
    ];
    const tipped = (turma: Turma) => tip()?.turmaId === turma.id;

    // The whole cell answers for the turma whose line is closest to the pointer, so moving down the column
    // never crosses a dead band between two ids.
    const turmaAt = (cell: HTMLElement, y: number) => {
        let closest: HTMLElement | undefined;
        let closestDistance = Infinity;
        for (const line of cell.querySelectorAll<HTMLElement>("[data-turma-id]")) {
            const { top, bottom } = line.getBoundingClientRect();
            const distance = Math.max(top - y, y - bottom, 0);
            if (distance < closestDistance) [closest, closestDistance] = [line, distance];
        }
        const turma = props.turmas.find((turma) => turma.id === closest?.dataset.turmaId);
        return turma && notes(turma).length > 0 ? { turma, id: closest!.firstElementChild! } : null;
    };
    const showTipAt = (cell: HTMLElement, y: number) => {
        const found = turmaAt(cell, y);
        if (found?.turma.id === tip()?.turmaId) return;
        setTip(
            found && { turmaId: found.turma.id, notes: notes(found.turma), anchor: found.id.getBoundingClientRect() },
        );
    };

    const toggleAllTurmas = () => {
        props.onToggleTurmas(
            props.turmas.map((turma) => turma.id), // All  turmas
            !props.turmas.every((turma) => turma.selected), // Toggle to selected if any is unselected, toggle to unselected otherwise
        );
    };

    return (
        <tr
            class="turma-item group cursor-pointer divide-x divide-neutral-400"
            onClick={toggleAllTurmas}
            onMouseEnter={props.onMouseEnter}
            onMouseLeave={props.onMouseLeave}
        >
            <td class="px-2.5">
                <div class="flex h-full flex-col">
                    <For each={props.turmas}>
                        {(turma) => (
                            <div class="flex items-center justify-center" style={{ height: turmaCellHeight(turma) }}>
                                <input
                                    type="checkbox"
                                    checked={turma.selected}
                                    onClick={(event) => event.stopPropagation()}
                                    onChange={(event) => props.onToggleTurmas([turma.id], event.currentTarget.checked)}
                                    class="hit-area-2.75 mr-0 cursor-pointer"
                                />
                            </div>
                        )}
                    </For>
                </div>
            </td>
            <td
                class="px-3 py-0.75"
                onPointerMove={(event) =>
                    event.pointerType === "mouse" && showTipAt(event.currentTarget, event.clientY)
                }
                onPointerLeave={(event) => event.pointerType === "mouse" && setTip(null)}
            >
                <For each={props.turmas}>
                    {(turma) => (
                        <div
                            data-turma-id={turma.id}
                            class="flex items-center"
                            style={{ height: turmaCellHeight(turma) }}
                        >
                            <span
                                class={clsx(
                                    "-mx-1 flex min-w-0 items-center rounded-sm px-1",
                                    tipped(turma) && "bg-white ring-1 ring-neutral-400",
                                )}
                            >
                                <span
                                    class={clsx(
                                        "truncate",
                                        isUnavailable(turma) && "line-through",
                                        isUnavailable(turma) && !tipped(turma) && "opacity-50",
                                    )}
                                >
                                    {turma.id}
                                </span>
                                <Show when={turma.status && !isUnavailable(turma)}>
                                    <span class="font-sans text-neutral-600">*</span>
                                </Show>
                            </span>
                        </div>
                    )}
                </For>
            </td>
            <td class="px-2 py-0.75 whitespace-nowrap">
                <For each={props.turmas}>
                    {(turma) => (
                        <div class="flex items-center justify-center" style={{ height: turmaCellHeight(turma) }}>
                            <span
                                class={clsx(
                                    "whitespace-pre tabular-nums",
                                    dimmed(turma),
                                    turma.vagas_ocupadas >= turma.vagas_ofertadas || turma.pedidos_sem_vaga
                                        ? "text-red-600"
                                        : "text-green-700",
                                )}
                            >
                                (<span title="Vagas ocupadas">{twochars(turma.vagas_ocupadas)}</span>
                                <span title="Pedidos sem vaga">
                                    {turma.pedidos_sem_vaga > 0
                                        ? `+${twochars(turma.pedidos_sem_vaga)}`
                                        : "\u00A0\u00A0\u00A0"}
                                </span>
                                /<span title="Vagas ofertadas">{twochars(turma.vagas_ofertadas)}</span>)
                            </span>
                        </div>
                    )}
                </For>
            </td>
            <td class="w-full min-w-0">
                <div class="flex min-h-9 flex-col justify-center px-3 py-1">
                    <For each={props.turmas}>
                        {(turma) => (
                            <div
                                class={clsx("flex flex-col justify-center", dimmed(turma))}
                                style={{ height: turmaCellHeight(turma) }}
                            >
                                <For
                                    each={turma.professores}
                                    fallback={<div class="flex h-6 items-center text-neutral-600">---</div>}
                                >
                                    {(professor) => (
                                        <div class="flex h-6 items-center">
                                            <p class="truncate">{professor}</p>
                                        </div>
                                    )}
                                </For>
                            </div>
                        )}
                    </For>
                </div>
            </td>
        </tr>
    );
}
