import { usePlanoStore } from "../../providers/plano/store";

const COLORS = [
    "lightblue",
    "lightcoral",
    "lightcyan",
    "lightgoldenrodyellow",
    "lightgray",
    "lightgrey",
    "lightgreen",
    "lightpink",
    "lightsalmon",
    "lightseagreen",
    "lightskyblue",
    "lightslategray",
    "lightslategrey",
    "lightsteelblue",
    "lightyellow",
];

export default function Materias() {
    const materias = usePlanoStore((state) => state.materias);
    const removeMateria = usePlanoStore((state) => state.removeMateria);

    const handleRemove = (id: string) => {
        removeMateria(id);
    };

    return (
        <div className="not-prose relative my-6 flex overflow-hidden rounded-md border border-neutral-400">
            <div className="relative flex-1 overflow-x-auto overflow-y-hidden">
                <table className="min-w-full table-fixed divide-y divide-neutral-400">
                    <thead className="relative bg-neutral-100">
                        <tr className="divide-x divide-neutral-300">
                            <th className="h-7 w-10 px-3 py-1.5 text-left font-semibold uppercase text-neutral-900">
                                <input
                                    type="checkbox"
                                    defaultChecked
                                    className="pointer-events-none mr-0 translate-y-[3px] cursor-pointer opacity-0"
                                />
                            </th>
                            <th className="h-7 px-3 py-1.5 text-left font-semibold uppercase text-neutral-900">
                                Código
                            </th>
                            <th className="h-7 px-3 py-1.5 text-left font-semibold uppercase text-neutral-900">
                                <div className="flex justify-between">
                                    <span>Matéria</span>
                                    <span className="font-normal normal-case text-neutral-400">Créditos: 22</span>
                                </div>
                            </th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-neutral-400">
                        {materias.map((materia, index) => {
                            return (
                                <tr
                                    key={index}
                                    data-materia-id={materia.id}
                                    style={{
                                        backgroundColor: materia.cor,
                                    }}
                                    className="materia-item group min-h-7 cursor-pointer divide-x divide-neutral-400"
                                    onMouseEnter={() =>
                                        document
                                            .querySelectorAll(`.horario-item[data-materia-id="${materia.id}"]`)
                                            ?.forEach((el) => el.classList.add("hovering"))
                                    }
                                    onMouseLeave={() =>
                                        document
                                            .querySelectorAll(`.horario-item[data-materia-id="${materia.id}"]`)
                                            ?.forEach((el) => el.classList.remove("hovering"))
                                    }
                                >
                                    <td className="px-3 py-1.5">
                                        <input
                                            type="checkbox"
                                            defaultChecked
                                            className="mr-0 translate-y-[2px] cursor-pointer"
                                        />
                                    </td>
                                    <td className="px-3 py-1.5">{materia.id}</td>
                                    <td className="px-3 py-1.5">
                                        <div className="flex items-center justify-between">
                                            <p>{materia.nome}</p>
                                            <button
                                                className="absolute right-0 mr-3 opacity-0 hover:underline group-hover:opacity-100"
                                                onClick={() => handleRemove(materia.id)}
                                            >
                                                Remover
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
