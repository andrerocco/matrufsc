import { Fragment, useEffect, useState } from "react";
import { Materia, usePlanoStore } from "~/providers/plano/store";
import { Plano } from "~/lib/combinacoes";
import { HORAS } from "~/providers/plano/constants";

const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

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

interface HorarioCell {
    id: string;
    sala: string;
    color: string;
}

interface HorariosDescriptor {
    [dia: number]: {
        [hora: string]: HorarioCell | null;
    };
}

// TODO: Improve
const HORARIOS_DESCRIPTOR: HorariosDescriptor = {
    1: {
        "0730": null,
        "0820": null,
        "0910": null,
        "1010": null,
        "1100": null,
        "1330": null,
        "1420": null,
        "1510": null,
        "1620": null,
        "1710": null,
        "1830": null,
        "1920": null,
        "2020": null,
        "2110": null,
    },
    2: {
        "0730": null,
        "0820": null,
        "0910": null,
        "1010": null,
        "1100": null,
        "1330": null,
        "1420": null,
        "1510": null,
        "1620": null,
        "1710": null,
        "1830": null,
        "1920": null,
        "2020": null,
        "2110": null,
    },
    3: {
        "0730": null,
        "0820": null,
        "0910": null,
        "1010": null,
        "1100": null,
        "1330": null,
        "1420": null,
        "1510": null,
        "1620": null,
        "1710": null,
        "1830": null,
        "1920": null,
        "2020": null,
        "2110": null,
    },
    4: {
        "0730": null,
        "0820": null,
        "0910": null,
        "1010": null,
        "1100": null,
        "1330": null,
        "1420": null,
        "1510": null,
        "1620": null,
        "1710": null,
        "1830": null,
        "1920": null,
        "2020": null,
        "2110": null,
    },
    5: {
        "0730": null,
        "0820": null,
        "0910": null,
        "1010": null,
        "1100": null,
        "1330": null,
        "1420": null,
        "1510": null,
        "1620": null,
        "1710": null,
        "1830": null,
        "1920": null,
        "2020": null,
        "2110": null,
    },
    6: {
        "0730": null,
        "0820": null,
        "0910": null,
        "1010": null,
        "1100": null,
        "1330": null,
        "1420": null,
        "1510": null,
        "1620": null,
        "1710": null,
        "1830": null,
        "1920": null,
        "2020": null,
        "2110": null,
    },
    7: {
        "0730": null,
        "0820": null,
        "0910": null,
        "1010": null,
        "1100": null,
        "1330": null,
        "1420": null,
        "1510": null,
        "1620": null,
        "1710": null,
        "1830": null,
        "1920": null,
        "2020": null,
        "2110": null,
    },
};

function generateHorariosFromPlano(plano?: Plano): HorariosDescriptor {
    if (!plano) return JSON.parse(JSON.stringify(HORARIOS_DESCRIPTOR)); // Deep clone the descriptor

    const horarios: HorariosDescriptor = JSON.parse(JSON.stringify(HORARIOS_DESCRIPTOR)); // Deep clone the descriptor

    plano.forEach(({ materia, turma }) => {
        turma.aulas.forEach((aula) => {
            aula.horarios.forEach((horarioIndex) => {
                const dia = aula.dia_semana;
                const hora = HORAS[horarioIndex];
                horarios[dia][hora] = {
                    id: materia.id,
                    sala: aula.sala,
                    color: materia.cor ?? "white", // TODO: How?
                };
            });
        });
    });

    return horarios;
}

export default function Horarios() {
    const combinacoes = usePlanoStore((state) => state.planos);
    const selectedCombinacaoIndex = usePlanoStore((state) => state.selectedPlanoIndex);

    const horarios = generateHorariosFromPlano(combinacoes[selectedCombinacaoIndex]);

    useEffect(() => {
        console.log(horarios);
    });

    const [showDetails, setShowDetails] = useState(false);

    return (
        <div>
            <table className="min-w-[520px] border-separate">
                <thead>
                    <tr>
                        <th className="w-0 whitespace-nowrap px-1 py-[5px] align-middle">
                            <input
                                title="Mostrar Salas"
                                type="checkbox"
                                onClick={() => setShowDetails(!showDetails)}
                                className="mx-auto w-4 cursor-pointer"
                            />
                        </th>
                        {DIAS.map((dia, index) => (
                            <th
                                key={index}
                                className="min-w-[60px] rounded border border-neutral-400 bg-neutral-100 px-1 py-[5px] uppercase text-neutral-500 shadow-sm"
                            >
                                {dia}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    <tr style={{ height: "4px" }}>
                        <td></td>
                        <td colSpan={DIAS.length} className=""></td>
                    </tr>
                    {HORAS.map((hora, hourIndex) => (
                        <Fragment key={hourIndex}>
                            {hora === "1330" || hora === "1830" ? (
                                <tr style={{ height: "4px" }}>
                                    <td></td>
                                    <td colSpan={DIAS.length} className=""></td>
                                </tr>
                            ) : null}
                            <tr>
                                <td className="w-0 whitespace-nowrap px-1 py-[5px]">
                                    {`${hora[0]}${hora[1]}:${hora[2]}${hora[3]}`}
                                    {showDetails && (
                                        <p className="block text-sm text-neutral-500">{HORAS_FIM[hourIndex]}</p>
                                    )}
                                </td>
                                {DIAS.map((_, dayIndex) => {
                                    const materia = horarios[dayIndex + 2]?.[hora]; // +2 já que segunda é 2
                                    // const materia = materiaId ? getMateria(materiaId) : null;

                                    if (!materia)
                                        return (
                                            <td
                                                key={dayIndex}
                                                className="min-w-[60px] rounded border border-neutral-500/80 bg-white px-1 py-[5px] shadow-sm"
                                            ></td>
                                        );
                                    else {
                                        console.log(materia);
                                    }

                                    return (
                                        <td
                                            key={dayIndex}
                                            data-materia-id={materia?.id}
                                            style={{ backgroundColor: materia?.color }}
                                            className="horario-item min-w-[60px] rounded border border-neutral-500/80 bg-white px-1 py-[5px] shadow-sm"
                                            align="center"
                                            onMouseEnter={() =>
                                                document
                                                    .querySelector(`.materia-item[data-materia-id="${materia?.id}"]`)
                                                    ?.classList.add("hovering")
                                            }
                                            onMouseLeave={() =>
                                                document
                                                    .querySelector(`.materia-item[data-materia-id="${materia?.id}"]`)
                                                    ?.classList.remove("hovering")
                                            }
                                        >
                                            <p className="block w-fit leading-none">{materia?.id}</p>
                                        </td>
                                    );
                                    // return (
                                    //     <HorarioItem
                                    //         key={dayIndex}
                                    //         materia={{
                                    //             id: "CIT7146",
                                    //             nome: "Introdução à Economia na Engenharia",
                                    //             turmas: [
                                    //                 {
                                    //                     id: "06653",
                                    //                     carga_horaria: 36,
                                    //                     aulas: [
                                    //                         {
                                    //                             dia_semana: 5,
                                    //                             horarios: [6, 7], // indices for 1420 and 1510
                                    //                             sala: "CTS-LB118A",
                                    //                         },
                                    //                     ],
                                    //                     professores: ["Simone Meister Sommer Bilessimo"],
                                    //                     selected: true,
                                    //                 },
                                    //             ],
                                    //             selected: true,
                                    //             cor: "lightblue",
                                    //         }}
                                    //     />
                                    // );
                                })}
                            </tr>
                        </Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function HorarioItem({ materia }: { materia: Materia }) {
    return (
        <td
            style={{ backgroundColor: materia?.cor }}
            className="min-w-[60px] rounded border border-neutral-500/80 bg-white px-1 py-[5px] shadow-sm"
            align="center"
        >
            <p className="block w-fit leading-none">{materia?.id}</p>
        </td>
    );
}
