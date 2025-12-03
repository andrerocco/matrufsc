import { createSignal, For, Show } from "solid-js";
// Context
import { usePlano } from "~/context/plano/Plano.store";
// Components
import CombinacaoSpinner from "./CombinacaoSpinner";
import HorarioCell, { type HorarioCellBase } from "./HorarioCell";
import { clsx } from "clsx";
import type { Plano } from "~/lib/combinacoes";

const DIAS = [
    { number: 2, name: "Segunda" },
    { number: 3, name: "Terça" },
    { number: 4, name: "Quarta" },
    { number: 5, name: "Quinta" },
    { number: 6, name: "Sexta" },
    { number: 7, name: "Sábado" },
];

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

interface HorariosDescriptor<T> {
    [dia: number]: {
        [hora: string]: T | null;
    };
}

export default function Horarios() {
    return (
        <div class="my-8 flex w-full flex-col items-center">
            <HorariosGrid />
            <div class="mt-2 flex w-full justify-center">
                <CombinacaoSpinner />
            </div>
        </div>
    );
}

function HorariosGrid() {
    const { currentPlano } = usePlano();

    const [showDetails, setShowDetails] = createSignal(false);

    const horarios = () => planoToHorariosDescriptor(currentPlano());

    return (
        <table class="min-w-[520px] table-fixed border-separate">
            <thead>
                <tr>
                    <th class="px-1 py-[5px] whitespace-nowrap">
                        <input
                            title="Mostrar salas..."
                            type="checkbox"
                            onClick={() => setShowDetails(!showDetails)}
                            class="mx-auto w-4 cursor-pointer align-middle"
                        />
                    </th>
                    <For each={DIAS}>
                        {(dia) => (
                            <th class="w-[80px] rounded border border-neutral-400 bg-neutral-100 px-1 py-[5px] text-neutral-500 uppercase shadow-sm">
                                {dia.name}
                            </th>
                        )}
                    </For>
                </tr>
            </thead>

            <tbody>
                <For each={HORAS}>
                    {(hora, index) => (
                        <>
                            <Show when={index() % 5 === 0 && index() !== 0}>
                                <tr class="h-[4px]">
                                    <td colSpan={DIAS.length + 1} />
                                </tr>
                            </Show>
                            <tr>
                                <td
                                    class={clsx(
                                        "px-2 tracking-tight whitespace-nowrap",
                                        showDetails() ? "py-0.5" : "py-1.5",
                                    )}
                                >
                                    <p>{hora}</p>
                                    <Show when={showDetails()}>
                                        <p class="block text-sm text-neutral-500">{HORAS_FIM[index()]}</p>
                                    </Show>
                                </td>
                                <For each={DIAS}>
                                    {(dia) => <HorarioCell base={horarios()[dia.number]?.[hora] ?? undefined} />}
                                </For>
                            </tr>
                        </>
                    )}
                </For>
            </tbody>
        </table>
    );
}

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
