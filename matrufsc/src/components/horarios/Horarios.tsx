import { createMemo, createSignal, For, Match, Show, Switch, type JSX } from "solid-js";
import { clsx } from "clsx";
// Context
import { usePlano, type Plano } from "~/context/plano/Plano.store";
import { useHorariosOverlay } from "./useHorariosOverlay";
import { HORAS, HORAS_FIM } from "./constants";
import type { HorariosDescriptor, HorarioCellBase, HorarioCellOverlay } from "./types";

const DIAS = [
    { number: 2, name: "Segunda" },
    { number: 3, name: "Terça" },
    { number: 4, name: "Quarta" },
    { number: 5, name: "Quinta" },
    { number: 6, name: "Sexta" },
    { number: 7, name: "Sábado" },
];

export default function Horarios(props: { class?: string }) {
    const [showDetails, setShowDetails] = createSignal(false);

    return (
        <div class={clsx(props.class)}>
            <table class="table-fixed border-separate">
                <HorariosTableHead showDetails={showDetails()} onChangeShowDetails={setShowDetails} />
                <HorariosTableBody showDetails={showDetails()} />
            </table>
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
                        class="hit-area-3.5 mx-auto w-4 cursor-pointer align-middle"
                    />
                </th>
                <For each={DIAS}>
                    {(dia) => (
                        <th
                            class={clsx(
                                WEEKDAY_COL_CLASS,
                                "rounded-sm border border-neutral-400 bg-neutral-100 px-1 py-1.5 font-normal text-neutral-700 shadow-xs",
                            )}
                        >
                            {dia.name}
                        </th>
                    )}
                </For>
            </tr>
        </thead>
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
                    turmaId: turma.id,
                    sala: aula.sala,
                    color: materia.cor ?? "lightblue",
                };
            }
        }
    }

    return horarios;
}

function HorariosTableBody(props: { showDetails: boolean }) {
    const { currentPlano } = usePlano();
    const { overlay, overlayMateriaId } = useHorariosOverlay();
    const horarios = createMemo(() => planoToHorariosDescriptor(currentPlano()));

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
                                        base={() => {
                                            const base = horarios()[dia.number]?.[hora] ?? undefined;
                                            const hiddenId = overlayMateriaId();
                                            if (base && hiddenId && base.id === hiddenId) return undefined;
                                            return base;
                                        }}
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

function HorarioCell(props: {
    base: () => HorarioCellBase | undefined;
    overlay: () => HorarioCellOverlay | undefined;
    showDetails?: boolean;
}) {
    const { hoverHorarioCell, clearHorarioHover } = useHorariosOverlay();

    const base = createMemo(props.base, undefined, {
        equals: (prev, next) => {
            if (prev === next) return true;
            if (!prev || !next) return false;
            return (
                prev.id === next.id &&
                prev.turmaId === next.turmaId &&
                prev.sala === next.sala &&
                prev.color === next.color
            );
        },
    });

    const overlay = createMemo(props.overlay, undefined, {
        equals: (prev, next) => {
            if (prev === next) return true;
            if (!prev || !next) return false;
            return prev.id === next.id && prev.turmaId === next.turmaId && prev.sala === next.sala;
        },
    });

    const conflict = () => base() && overlay() && base()!.id !== overlay()!.id;
    const hoverTarget = () => overlay() ?? base();

    // createEffect(() => {
    //     console.log("Overlay updated for position", props.position, ":", overlay());
    // });

    // createEffect(() => {
    //     console.log("Base updated for position", props.position, ":", base());
    // });

    return (
        <Switch fallback={<EmptyHorarioCell />}>
            <Match when={conflict()}>
                <FilledHorarioCell
                    title={overlay()!.id}
                    class="bg-red-500"
                    onMouseEnter={() => {
                        const target = hoverTarget();
                        if (target) hoverHorarioCell(target.id, target.turmaId);
                    }}
                    onMouseLeave={clearHorarioHover}
                />
            </Match>
            <Match when={overlay()}>
                <FilledHorarioCell
                    title={overlay()!.id}
                    subtitle={props.showDetails ? overlay()!.sala : undefined}
                    class="bg-black text-white"
                    onMouseEnter={() => {
                        const target = hoverTarget();
                        if (target) hoverHorarioCell(target.id, target.turmaId);
                    }}
                    onMouseLeave={clearHorarioHover}
                />
            </Match>
            <Match when={base()}>
                <FilledHorarioCell
                    title={base()!.id}
                    subtitle={props.showDetails ? base()!.sala : undefined}
                    style={base()?.color ? { "background-color": base()!.color } : undefined}
                    onMouseEnter={() => {
                        const target = hoverTarget();
                        if (target) hoverHorarioCell(target.id, target.turmaId);
                    }}
                    onMouseLeave={clearHorarioHover}
                />
            </Match>
        </Switch>
    );
}

function EmptyHorarioCell() {
    return (
        <td
            class={clsx(
                "horario-item h-[30px] rounded-sm border border-neutral-500/80 bg-white px-1 py-[5px]",
                WEEKDAY_COL_CLASS,
            )}
        />
    );
}

function FilledHorarioCell(props: {
    title: string;
    subtitle?: string;
    style?: JSX.CSSProperties;
    class?: string;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
}) {
    return (
        <td
            class={clsx(
                "horario-item h-[30px] rounded-sm border border-neutral-500/80 px-1 py-[5px] text-center",
                WEEKDAY_COL_CLASS,
                props.class,
            )}
            style={props.style}
            onMouseEnter={props.onMouseEnter}
            onMouseLeave={props.onMouseLeave}
        >
            <p class="block w-full truncate text-center leading-none">{props.title}</p>
            <Show when={props.subtitle}>
                <p class="mt-1 block w-full truncate text-center text-sm leading-none tracking-tight">
                    {props.subtitle}
                </p>
            </Show>
        </td>
    );
}

const WEEKDAY_COL_CLASS = "w-[80px] min-w-[80px] max-w-[80px]";
