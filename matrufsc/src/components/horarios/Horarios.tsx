import { Fragment, useState } from "react";
import { create } from "zustand";
import { cn } from "~/lib/utils";
// Providers
import { usePlanoStore } from "~/providers/plano/store";
import { type Plano } from "~/lib/combinacoes";
// Components
import HorarioCell, { type HorarioCellBase, type HorarioCellOverlay } from "./HorarioCell";
import CombinacaoSpinner from "~/components/horarios/CombinacaoSpinner";

// TODO: Move constants to a separate file?
const HORAS = [
    "07:30",
    "08:20",
    "09:10",
    "10:10",
    "11:00",
    "13:30",
    "14:20",
    "15:10",
    "16:20",
    "17:10",
    "18:30",
    "19:20",
    "20:20",
    "21:10",
];

const DIAS = [
    {
        number: 2,
        name: "Segunda",
    },
    {
        number: 3,
        name: "Terça",
    },
    {
        number: 4,
        name: "Quarta",
    },
    {
        number: 5,
        name: "Quinta",
    },
    {
        number: 6,
        name: "Sexta",
    },
    {
        number: 7,
        name: "Sábado",
    },
];

const HORAS_FIM = [
    "08:20",
    "09:10",
    "10:00",
    "11:00",
    "11:50",
    "14:20",
    "15:10",
    "16:00",
    "17:10",
    "18:00",
    "19:20",
    "20:10",
    "21:10",
    "22:00",
];

// Type definitions
interface HorariosDescriptor<T> {
    [dia: number]: {
        [hora: string]: T | null;
    };
}

// Zustand store for managing the grid data
interface HorariosStore {
    horarios: HorariosDescriptor<HorarioCellOverlay>;
    updateCell: (dia: number, hora: string, cell: HorarioCellOverlay | null) => void;
    bulkUpdate: (newData: Partial<HorariosDescriptor<HorarioCellOverlay>>) => void;
    clear: () => void;
}

const useHorariosStore = create<HorariosStore>((set) => ({
    horarios: {},
    updateCell: (dia, hora, cell) =>
        set((state) => {
            const newHorarios = { ...state.horarios };

            if (!newHorarios[dia]) {
                newHorarios[dia] = {};
            }

            newHorarios[dia] = { ...newHorarios[dia], [hora]: cell };
            return { horarios: newHorarios };
        }),
    bulkUpdate: (newData) =>
        set((state) => {
            const newHorarios = { ...state.horarios };

            // Merge new data with existing data
            Object.entries(newData).forEach(([diaStr, horasData]) => {
                const dia = Number(diaStr);
                if (!newHorarios[dia]) {
                    newHorarios[dia] = {};
                }

                newHorarios[dia] = { ...newHorarios[dia], ...horasData };
            });

            return { horarios: newHorarios };
        }),
    clear: () => set({ horarios: {} }),
}));

// API for external components to interact with the store
export const horariosApi = {
    updateCell: (dia: number, hora: string, cell: HorarioCellOverlay | null) => {
        useHorariosStore.getState().updateCell(dia, hora, cell);
    },
    bulkUpdate: (newData: Partial<HorariosDescriptor<HorarioCellOverlay>>) => {
        useHorariosStore.getState().bulkUpdate(newData);
    },
    clear: () => {
        useHorariosStore.getState().clear();
    },
};

// Memoize for fine grained updates (only re-renders the cell where the data has changed).
// TODO: Remove, React compiler should handle this automatically
// const Cell = memo(HorarioCell, (prevProps, nextProps) => {
//     // Custom comparison function for memoization
//     if (!prevProps.base && !nextProps.base) return true;
//     if (!prevProps.base || !nextProps.base) return false;

//     return (
//         prevProps.base.id === nextProps.base.id &&
//         prevProps.base.sala === nextProps.base.sala &&
//         prevProps.base.color === nextProps.base.color
//     );
// });

// CellContainer wraps over the Cell component and provides it the data from the store.
// By referencing a specific cell in the zustand store, re-renders only happen when that cell's data changes.
// Changes to other cells do not trigger updates in this component.
const CellContainer = ({ dia, hora, base }: { dia: number; hora: string; base?: HorarioCellBase }) => {
    const cellOverlay = useHorariosStore((state) => state.horarios[dia]?.[hora]);

    return <HorarioCell base={base ?? undefined} overlay={cellOverlay ?? undefined} />;
};

function planoToHorariosDescriptor(plano: Plano | null): HorariosDescriptor<HorarioCellBase> {
    if (!plano) return {};

    const horarios: HorariosDescriptor<HorarioCellBase> = {};

    for (const { materia, turma } of plano) {
        for (const aula of turma.aulas) {
            for (const hora of aula.horarios) {
                if (!horarios[aula.dia_semana]) {
                    horarios[aula.dia_semana] = {};
                }

                horarios[aula.dia_semana]![HORAS[hora]] = {
                    id: materia.id,
                    sala: aula.sala,
                    color: materia.cor ?? "lightblue",
                };
            }
        }
    }

    return horarios;
}

function HorariosGrid({
    dias,
    horas,
    // base,
    // overlay,
}: {
    dias: { number: number; name: string }[];
    horas: string[];
    // base: HorariosDescriptor<HorarioCellBase>;
    // overlay: HorariosDescriptor<HorarioCellOverlay>;
}) {
    const plano = usePlanoStore((state) => state.currentPlano);
    const horarios = planoToHorariosDescriptor(plano);

    const [showDetails, setShowDetails] = useState(false);

    const SpacerRow = () => (
        <tr className="h-[4px]">
            <td colSpan={dias.length + 1} />
        </tr>
    );

    return (
        <table className="min-w-[520px] table-fixed border-separate">
            <thead>
                <tr>
                    <th className="whitespace-nowrap px-1 py-[5px]">
                        <input
                            title="Mostrar salas..."
                            type="checkbox"
                            onClick={() => setShowDetails(!showDetails)}
                            className="mx-auto w-4 cursor-pointer align-middle"
                        />
                    </th>
                    {dias.map((dia) => (
                        <th
                            key={dia.number}
                            className="w-[80px] rounded border border-neutral-400 bg-neutral-100 px-1 py-[5px] uppercase text-neutral-500 shadow-sm"
                        >
                            {dia.name}
                        </th>
                    ))}
                </tr>
            </thead>

            <tbody>
                {horas.map((hora, index) => (
                    <Fragment key={hora}>
                        {index % 5 === 0 && <SpacerRow />}
                        <tr>
                            <td
                                className={cn(
                                    "whitespace-nowrap px-2 tracking-tight",
                                    showDetails ? "py-0.5" : "py-1.5",
                                )}
                            >
                                <p>{hora}</p>
                                {showDetails && <p className="block text-sm text-neutral-500">{HORAS_FIM[index]}</p>}
                            </td>
                            {dias.map((dia) => (
                                <CellContainer
                                    key={`${dia.number}-${hora}`}
                                    dia={dia.number}
                                    hora={hora}
                                    base={horarios[dia.number]?.[hora] ?? undefined}
                                />
                            ))}
                        </tr>
                    </Fragment>
                ))}
            </tbody>
        </table>
    );
}

function Popover({ onClose }: { onClose: () => void }) {
    const [titulo, setTitulo] = useState(""); // Add state for titulo

    return (
        <div className="absolute left-full top-0 ml-4 w-80">
            <div className="rounded-lg border border-neutral-300 bg-white p-4 shadow-lg">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold">Adicionar Compromisso</h2>
                    <button
                        onClick={onClose}
                        className="text-lg text-neutral-500 hover:text-neutral-800"
                    >
                        ×
                    </button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-neutral-600">
                            Título
                        </label>
                        <input
                            type="text"
                            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 focus:border-neutral-500 focus:outline-none"
                            value={titulo}
                            maxLength={10}
                            onChange={(e) => setTitulo(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex justify-between mt-4">
                    <button
                        className="bg-gray-300 text-black py-2 rounded w-5/12"
                        onClick={onClose}
                    >
                        Cancelar
                    </button>
                    <button
                        className="bg-blue-500 text-white py-2 rounded w-5/12"
                    >
                        Adicionar
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function Horarios() {
    const isPopoverOpen = usePlanoStore((state) => state.isPopoverOpen);
    const closePopover = usePlanoStore((state) => state.closePopover);

    return (
        <div className="my-8 flex w-full flex-col items-center">
            <div className="relative">
                <HorariosGrid dias={DIAS} horas={HORAS} />
                {isPopoverOpen && <Popover onClose={closePopover} />}
            </div>
            <div className="mt-2 flex w-full justify-center">
                <CombinacaoSpinner />
            </div>
        </div>
    );
}
