import { createMemo, createSignal, For, Show } from "solid-js";
import { clsx } from "clsx";
import type { Plano } from "~/lib/combinacoes";
// Context
import { usePlano } from "~/context/plano/Plano.store";
import { useHorariosOverlay } from "./useHorariosOverlay";
// Components
import CombinacaoSpinner from "./CombinacaoSpinner";

const DIAS = [
    { number: 2, name: "Segunda" },
    { number: 3, name: "Terça" },
    { number: 4, name: "Quarta" },
    { number: 5, name: "Quinta" },
    { number: 6, name: "Sexta" },
    { number: 7, name: "Sábado" },
];

export const HORAS = [
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

export interface HorariosDescriptor<T> {
    [dia: number]: {
        [hora: string]: T | null;
    };
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

export default function Horarios(props: { class?: string }) {
    const [showDetails, setShowDetails] = createSignal(false);

    return (
        <div class={clsx("w-full min-w-fit", props.class)}>
            <div class="flex flex-col items-center">
                <table class="min-w-[520px] table-fixed border-separate">
                    <HorariosTableHead showDetails={showDetails()} onChangeShowDetails={setShowDetails} />
                    <HorariosTableBody showDetails={showDetails()} />
                </table>
                <div class="mt-2 flex w-full justify-center pl-2">
                    <CombinacaoSpinner />
                </div>
            </div>
        </div>
    );
}

function HorariosTableHead(props: { showDetails: boolean; onChangeShowDetails: (show: boolean) => void }) {
    return (
        <thead>
            <tr>
                <th class="px-1 py-[5px] whitespace-nowrap">
                    <input
                        title="Mostrar salas..."
                        type="checkbox"
                        checked={props.showDetails}
                        onChange={(e) => props.onChangeShowDetails(e.currentTarget.checked)}
                        class="mx-auto w-4 cursor-pointer align-middle"
                    />
                </th>
                <For each={DIAS}>
                    {(dia) => (
                        <th class="w-20 rounded border border-neutral-400 bg-neutral-100 px-1 py-[5px] text-neutral-500 uppercase shadow-sm">
                            {dia.name}
                        </th>
                    )}
                </For>
            </tr>
        </thead>
    );
}

function HorariosTableBody(props: { showDetails: boolean }) {
    const { currentPlano } = usePlano();
    const { overlay } = useHorariosOverlay();

    const horarios = () => planoToHorariosDescriptor(currentPlano());

    return (
        <tbody>
            <For each={HORAS}>
                {(hora, horaIndex) => (
                    <>
                        <Show when={horaIndex() % 5 === 0 && horaIndex() !== 0}>
                            <tr class="h-1">
                                <td colSpan={DIAS.length + 1} />
                            </tr>
                        </Show>
                        <tr>
                            <td
                                class={clsx(
                                    "px-2 tracking-tight whitespace-nowrap",
                                    props.showDetails ? "py-0.5" : "py-1.5",
                                )}
                            >
                                <p>{hora}</p>
                                <Show when={props.showDetails}>
                                    <p class="block text-sm text-neutral-500">{HORAS_FIM[horaIndex()]}</p>
                                </Show>
                            </td>
                            <For each={DIAS}>
                                {(dia) => (
                                    <HorarioCell
                                        base={() => horarios()[dia.number]?.[hora] ?? undefined}
                                        overlay={() => overlay()[dia.number]?.[hora] ?? undefined}
                                        showDetails={props.showDetails}
                                    />
                                )}
                            </For>
                        </tr>
                    </>
                )}
            </For>
        </tbody>
    );
}

interface HorarioCellBase {
    id: string;
    sala: string;
    color: string;
}

export interface HorarioCellOverlay {
    id: string;
}

function HorarioCell(props: {
    base: () => HorarioCellBase | undefined;
    overlay: () => HorarioCellOverlay | undefined;
    showDetails?: boolean;
}) {
    const base = createMemo(props.base, undefined, {
        equals: (prev, next) => {
            if (prev === next) return true;
            if (!prev || !next) return false;
            return prev.id === next.id && prev.sala === next.sala && prev.color === next.color;
        },
    });

    const overlay = createMemo(props.overlay, undefined, {
        equals: (prev, next) => {
            if (prev === next) return true;
            if (!prev || !next) return false;
            return prev.id === next.id;
        },
    });

    const conflict = () => base() && overlay() && base()!.id !== overlay()!.id;

    return (
        <Show
            when={!overlay()}
            fallback={
                <td
                    data-materia-id={overlay()!.id}
                    class={clsx(
                        "horario-item h-[30px] w-[80px] rounded border border-neutral-500/80 px-1 py-[5px] text-center",
                        conflict() ? "bg-red-600" : "bg-black text-white",
                    )}
                >
                    <p class="block w-full truncate text-center leading-none">{overlay()!.id}</p>
                </td>
            }
        >
            <Show
                when={base()}
                fallback={
                    <td class="horario-item h-[30px] w-[80px] rounded border border-neutral-500/80 bg-white px-1 py-[5px]" />
                }
            >
                <td
                    data-materia-id={base()!.id}
                    class="horario-item h-[30px] w-[80px] rounded border border-neutral-500/80 bg-white px-1 py-[5px] text-center"
                    style={{ "background-color": base()!.color }}
                >
                    <p class="block w-full truncate text-center leading-none">{base()!.id}</p>
                    <Show when={props.showDetails}>
                        <p class="mt-0.5 block w-full truncate text-center text-sm leading-none tracking-tight">
                            {base()!.sala}
                        </p>
                    </Show>
                </td>
            </Show>
        </Show>
    );
}
