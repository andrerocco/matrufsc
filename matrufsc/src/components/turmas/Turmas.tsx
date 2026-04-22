import clsx from "clsx";
import { createMemo, For, Show, type Accessor } from "solid-js";
import { mergeEquivalentTurmas } from "~/context/plano/combinacoes";
import { usePlano, type Materia, type Turma } from "~/context/plano/Plano.store";
import { useHorariosOverlay } from "../horarios/useHorariosOverlay";

export default function Turmas(props: { class?: string }) {
    const { materias, selectedMateriaId, setSelectedMateriaId, updateTurmasSelected } = usePlano();
    const { clearOverlay } = useHorariosOverlay();

    const selectedMateria = () => {
        const selectedId = selectedMateriaId();
        return materias.find((materia) => materia.id === selectedId) ?? null;
    };

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
                                    setSelectedMateriaId(null);
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

        const turmas = materia().turmas;
        const groupedByHorario = mergeEquivalentTurmas(turmas);

        return Object.values(groupedByHorario).map((grupo) => {
            const professores = Array.from(new Set(grupo.flatMap((turma) => turma.professores ?? []))).sort();
            return { professores, turmas: grupo };
        });
    });

    return (
        <For each={groupedTurmas()} fallback={<TurmasEmptyRow message="Nenhuma turma disponível para esta matéria." />}>
            {(groupedTurma) => (
                <TurmaRow
                    id={`turma-${groupedTurma.turmas[0].id}`} // Use the first turma's id as the group id
                    professores={groupedTurma.professores}
                    turmas={groupedTurma.turmas}
                    onToggleTurmas={(turmaIds, value) => props.onToggleTurmas?.(materia().id, turmaIds, value)}
                    onMouseEnter={() => {
                        // Select one turma from the group as preview for the overlay
                        const previewTurma =
                            groupedTurma.turmas.find((turma) => turma.selected) ?? groupedTurma.turmas[0];
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

function TurmaRow(props: {
    id: string;
    professores: string[];
    turmas: Turma[];
    onToggleTurmas: (turmaIds: string[], value: boolean) => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
}) {
    const twochars = (n: number) => `${n < 10 ? "\u00A0" : ""}${n}`;

    const getPedidosSemVaga = (turma: Turma) => {
        const turmaWithExtras = turma as Turma & { pedidos_sem_vaga?: number; vagas_excedentes?: number };
        return turmaWithExtras.pedidos_sem_vaga ?? turmaWithExtras.vagas_excedentes ?? 0;
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
                            <div class="flex h-6 items-center justify-center">
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
            <td class="px-3 py-0.75">
                <For each={props.turmas}>
                    {(turma) => (
                        <div class="flex h-6 items-center">
                            <span class="truncate">{turma.id}</span>
                        </div>
                    )}
                </For>
            </td>
            <td class="px-2 py-0.75 whitespace-nowrap">
                <For each={props.turmas}>
                    {(turma) => {
                        const pedidosSemVaga = getPedidosSemVaga(turma);

                        return (
                            <div class="flex h-6 items-center justify-center">
                                <span
                                    class={clsx(
                                        "whitespace-pre tabular-nums",
                                        turma.vagas_ocupadas >= turma.vagas_ofertadas || pedidosSemVaga
                                            ? "text-red-600"
                                            : "text-green-700",
                                    )}
                                >
                                    (<span title="Vagas ocupadas">{twochars(turma.vagas_ocupadas)}</span>
                                    <span title="Pedidos sem vaga">
                                        {pedidosSemVaga > 0 ? `+${twochars(pedidosSemVaga)}` : "\u00A0\u00A0\u00A0"}
                                    </span>
                                    /<span title="Vagas ofertadas">{twochars(turma.vagas_ofertadas)}</span>)
                                </span>
                            </div>
                        );
                    }}
                </For>
            </td>
            <td class="w-full min-w-0">
                <div class="flex min-h-9 flex-col justify-center px-3 py-1">
                    <For
                        // each={[...props.professores, ...props.professores]}
                        each={props.professores}
                        fallback={<span class="text-neutral-600">---</span>}
                    >
                        {(professor) => (
                            <div class="flex h-6 items-center">
                                <p class="truncate">{professor}</p>
                            </div>
                        )}
                    </For>
                </div>
            </td>
        </tr>
    );
}
