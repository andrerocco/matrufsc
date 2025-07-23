import { Materia } from "~/lib/combinacoes";
import { usePlanoStore } from "~/providers/plano/store";
import { useHorariosStore } from "../horarios/Horarios";
import { useTurmasList } from "../turmas/Turmas";

export default function Materias() {
    const materias = usePlanoStore((state) => state.materias);

    return (
        <div className="not-prose relative my-6 flex overflow-hidden rounded-md border border-neutral-400">
            <div className="relative flex-1 overflow-x-auto overflow-y-hidden">
                <table className="min-w-full table-fixed divide-y divide-neutral-400">
                    <MateriasTableHead creditos={0} />

                    <tbody className="divide-y divide-neutral-400">
                        {materias.map((materia, index) => (
                            <MateriaRow key={index} materia={materia} />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function MateriasTableHead({ creditos }: { creditos: number }) {
    return (
        <thead className="relative bg-neutral-100">
            <tr className="divide-x divide-neutral-300">
                <th className="h-7 w-10 px-3 py-1.5 text-left font-semibold uppercase text-neutral-900">
                    <input
                        type="checkbox"
                        defaultChecked
                        className="pointer-events-none mr-0 translate-y-[3px] cursor-pointer opacity-0"
                    />
                </th>
                <th className="h-7 w-24 px-3 py-1.5 text-left font-semibold uppercase text-neutral-900">Código</th>
                <th className="h-7 px-3 py-1.5 text-left font-semibold uppercase text-neutral-900">
                    <div className="flex justify-between">
                        <span>Matéria</span>
                        <span className="font-normal normal-case text-neutral-400">Créditos: {creditos}</span>
                    </div>
                </th>
            </tr>
        </thead>
    );
}

function MateriaRow({ materia }: { materia: Materia }) {
    const removeMateria = usePlanoStore((state) => state.removeMateria);
    const updateMateriaSelection = usePlanoStore((state) => state.updateMateriaSelection);

    // Get the update and clear functions from the horarios store
    const setOverlay = useHorariosStore((state) => state.setOverlay);
    const clearOverlay = useHorariosStore((state) => state.clear);

    const { open: openTurmasList } = useTurmasList();

    // TODO: This is bad, having to subscribe to this currentPlano just to get the overlay
    const currentPlano = usePlanoStore((state) => state.currentPlano);
    const handleHighlightMateria = () => {
        if (materia.selected && !materia.blocked) {
            // Use the aulas that are already in the currentPlano
            const aulasInPlano = currentPlano?.find((planoItem) => planoItem.materia.id === materia.id)?.turma?.aulas;
            if (aulasInPlano) {
                setOverlay(materia.id, aulasInPlano);
                return;
            }
        } else {
            // Use the first set of aulas that is not unselected
            const selectedAulas = materia.turmas.filter((turma) => turma.selected)[0]?.aulas;
            if (selectedAulas) {
                setOverlay(materia.id, selectedAulas);
                return;
            }
        }
    };

    const handleClickRow = () => {
        openTurmasList(materia);
    };

    const handleChangeInputSelection = () => {
        updateMateriaSelection(materia.id, !materia.selected);
    };

    const handleClickRemove = () => {
        removeMateria(materia.id);
        clearOverlay();
    };

    return (
        <tr
            data-materia-id={materia.id}
            style={{ backgroundColor: materia.cor }}
            className="materia-item group min-h-7 cursor-pointer divide-x divide-neutral-400"
            onMouseEnter={handleHighlightMateria}
            onMouseLeave={clearOverlay}
            onClick={handleClickRow}
        >
            <td className="px-3 py-1.5">
                <input
                    className="mr-0 translate-y-[2px] cursor-pointer"
                    type="checkbox"
                    checked={materia.selected}
                    disabled={materia.blocked}
                    title={materia.blocked ? "Bloqueada por conflito com matéria(s) acima na lista8" : ""}
                    onClick={(event) => event.stopPropagation()}
                    onChange={handleChangeInputSelection}
                />
            </td>
            <td className="px-3 py-1.5">{materia.id}</td>
            <td className="px-3 py-1.5">
                <div className="flex items-center justify-between">
                    <p>{materia.nome}</p>
                    <button
                        className="absolute right-0 mr-3 opacity-0 hover:underline group-hover:opacity-100"
                        onClick={(event) => {
                            event.stopPropagation();
                            handleClickRemove();
                        }}
                    >
                        Remover
                    </button>
                </div>
            </td>
        </tr>
    );
}
