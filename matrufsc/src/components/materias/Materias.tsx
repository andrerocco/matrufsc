import clsx from "clsx";
import { For, Show } from "solid-js";
import { usePlano, type Materia } from "~/context/plano/Plano.store";
import { useHorariosOverlay } from "../horarios/useHorariosOverlay";

export default function Materias(props: { class?: string }) {
    const { materias, removeMateria, updateMateriaSelected } = usePlano();
    const { overlayMateria, clearOverlay } = useHorariosOverlay();

    const handleRemove = (id: string) => {
        clearOverlay();
        removeMateria(id);
    };

    const handleToggleSelection = (id: string, currentSelected: boolean) => {
        clearOverlay();
        updateMateriaSelected(id, !currentSelected);
    };

    return (
        <div class={clsx("not-prose relative flex overflow-hidden rounded-md border border-neutral-400", props.class)}>
            <div class="relative flex-1 overflow-x-auto overflow-y-hidden">
                <table class="min-w-full table-fixed divide-y divide-neutral-400">
                    <MateriasTableHead creditos={0} />

                    <Show when={materias.length > 0}>
                        <tbody class="divide-y divide-neutral-400">
                            <For each={materias}>
                                {(materia) => (
                                    <MateriaRow
                                        materia={materia}
                                        onClickRemove={handleRemove}
                                        onToggleSelection={handleToggleSelection}
                                        onMouseEnter={() => overlayMateria(materia)}
                                        onMouseLeave={clearOverlay}
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
                    </Show>
                </table>
            </div>
        </div>
    );
}

function MateriasTableHead(props: { creditos: number }) {
    return (
        <thead class="relative bg-neutral-100">
            <tr class="divide-x divide-neutral-300">
                <th class="h-7 w-10 px-3 py-1.5 text-left font-semibold text-neutral-900 uppercase">
                    <input
                        type="checkbox"
                        checked
                        class="pointer-events-none mr-0 translate-y-[3px] cursor-pointer opacity-0"
                    />
                </th>
                <th class="h-7 w-24 px-3 py-1.5 text-left font-semibold text-neutral-900 uppercase">Código</th>
                <th class="h-7 px-3 py-1.5 text-left font-semibold text-neutral-900 uppercase">
                    <div class="flex justify-between">
                        <span>Matéria</span>
                        <span class="font-normal text-neutral-400 normal-case">Créditos: {props.creditos}</span>
                    </div>
                </th>
            </tr>
        </thead>
    );
}

function MateriaRow(props: {
    materia: Materia;
    onToggleSelection: (id: string, currentSelected: boolean) => void;
    onClickRemove: (id: string) => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
}) {
    console.log("Rendering MateriaRow for ", props.materia.id);

    return (
        <tr
            data-materia-id={props.materia.id}
            style={{ "background-color": props.materia.cor }}
            class="materia-item group min-h-7 cursor-pointer divide-x divide-neutral-400"
            onMouseEnter={props.onMouseEnter}
            onMouseLeave={props.onMouseLeave}
        >
            <td class="px-3 py-1.5">
                <input
                    type="checkbox"
                    checked={props.materia.selected}
                    disabled={props.materia.blocked}
                    title={props.materia.blocked ? "Conflito com matéria(s) acima na lista" : ""}
                    onChange={() => props.onToggleSelection(props.materia.id, props.materia.selected)}
                    class="mr-0 translate-y-0.5 cursor-pointer"
                />
            </td>
            <td class="px-3 py-1.5">{props.materia.id}</td>
            <td class="px-3 py-1.5">
                <div class="flex items-center justify-between">
                    <p>{props.materia.nome}</p>
                    <button
                        class="absolute right-0 mr-3 cursor-pointer opacity-0 group-hover:opacity-100 hover:underline"
                        onClick={() => props.onClickRemove(props.materia.id)}
                    >
                        Remover
                    </button>
                </div>
            </td>
        </tr>
    );
}
