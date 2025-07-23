import { Fragment, useState } from "react";
import { create } from "zustand";
import { cn } from "~/lib/utils";
// Providers
import { Aula, type Plano } from "~/lib/combinacoes";
import { usePlanoStore } from "~/providers/plano/store";
// Components
import CombinacaoSpinner from "~/components/horarios/CombinacaoSpinner";
import HorarioCell, { type HorarioCellBase, type HorarioCellOverlay } from "./HorarioCell";

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
    horarios: HorariosDescriptor<HorarioCellBase>;
    overlay: HorariosDescriptor<HorarioCellOverlay>;
    currentOverlay: string | null;
    setOverlay: (materiaId: string, aulas: Aula[]) => void;
    clear: () => void;
}

export const useHorariosStore = create<HorariosStore>((set) => ({
    horarios: {},
    overlay: {},
    currentOverlay: null,
    setOverlay: (materiaId: string, aulas: Aula[]) => {
        const newOverlay = aulas.reduce<HorariosDescriptor<HorarioCellOverlay>>((acc, aula) => {
            aula.horarios.forEach((hora) => {
                if (!acc[aula.dia_semana]) {
                    acc[aula.dia_semana] = {};
                }
                acc[aula.dia_semana]![HORAS[hora]] = { id: materiaId };
            });
            return acc;
        }, {});
        set({
            overlay: newOverlay,
            currentOverlay: materiaId,
        });
    },
    clear: () => set({ overlay: {}, currentOverlay: null }),
}));

const CellContainer = ({ dia, hora, base }: { dia: number; hora: string; base?: HorarioCellBase }) => {
    const cellOverlay = useHorariosStore((state) => state.overlay[dia]?.[hora]);
    const hideBase = useHorariosStore((state) => state.currentOverlay === base?.id);

    return <HorarioCell base={hideBase ? undefined : base} overlay={cellOverlay ?? undefined} />;
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

function HorariosGrid({ dias, horas }: { dias: { number: number; name: string }[]; horas: string[] }) {
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
                            className="w-[80px] rounded-sm border border-neutral-400 bg-neutral-100 px-1 py-[5px] uppercase text-neutral-500 shadow-xs"
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

export default function Horarios() {
    return (
        <div className="my-8 flex flex-col items-center">
            <HorariosGrid dias={DIAS} horas={HORAS} />
            <div className="mt-2 flex w-full justify-center">
                <CombinacaoSpinner />
            </div>
        </div>
    );
}
