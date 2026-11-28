import { createMemo, createSignal, For, Match, Show, Switch, type JSX } from "solid-js";
import { clsx } from "clsx";
// Context
import { usePlano, type Plano } from "~/context/plano/Plano.store";
import type { Materia } from "~/data/types";
import { isPhone } from "~/lib/media";
import { useHorariosOverlay } from "./useHorariosOverlay";

const DIAS = [
    { number: 2, name: "Segunda", short: "Seg" },
    { number: 3, name: "Terça", short: "Ter" },
    { number: 4, name: "Quarta", short: "Qua" },
    { number: 5, name: "Quinta", short: "Qui" },
    { number: 6, name: "Sexta", short: "Sex" },
    { number: 7, name: "Sábado", short: "Sáb" },
];

type Dia = (typeof DIAS)[number];

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

const [showDetails, setShowDetails] = createSignal(false); // module level so is shared across instances (so value is preserved when exporting image)

const ROWS = HORAS.length + 1;
// What the rows leave of a staged grid's height, in whole px: the two gaps between periods (`h-1`) and the 2px
// of spacing around every row.
const STAGE_CHROME = Math.floor(2 * 3.25 + (ROWS + 3) * 2);
// No shorter than the hours' line of text, which is smaller on a phone.
const stagedRow = (stage: number) => Math.max(isPhone() ? 17 : 20, Math.floor((stage - STAGE_CHROME) / ROWS));
export const stagedHeight = (stage: number) => stagedRow(stage) * ROWS + STAGE_CHROME;

// Follows the selection rather than the combination shown, so the columns hold still while cycling combinations.
const hasSabado = (materias: readonly Materia[]) =>
    materias.some(
        (materia) =>
            materia.selected &&
            materia.turmas.some((turma) => turma.selected && turma.aulas.some((aula) => aula.dia_semana === 7)),
    );

// `stage` is the height, in px, the touch layout fits the grid in; without it this is the desktop grid, as in
// the exported image. The salas need taller rows than a stage leaves, so they show only with no sheet open, and
// the grid grows back for them.
export default function Horarios(props: { class?: string; stage?: number }) {
    const { materias, currentPlano, focusedMateriaId } = usePlano();
    const { overlay } = useHorariosOverlay();

    const fluid = () => props.stage !== undefined && isPhone();
    const underSheet = () => props.stage !== undefined && focusedMateriaId() !== null;
    const details = () => showDetails() && !underSheet();
    const staged = () => props.stage !== undefined && !details();
    const dias = () => (!fluid() || hasSabado(materias) || overlay()[7] ? DIAS : DIAS.slice(0, 5));
    const colClass = () => (fluid() ? "px-1 tracking-tight" : "w-[80px] min-w-[80px] max-w-[80px] px-1");
    const rowClass = () => (staged() ? "h-(--row) py-0" : "h-[30px] py-[5px]");

    // The narrow grid never truncates a cell: past the width its longest code or sala needs, it scrolls sideways.
    // Over a sheet, which keeps the page from scrolling, it shows the whole week instead.
    const minWidth = () => {
        let id = 0;
        let sala = 0;
        const fit = (cell: { id: string; sala: string }) => {
            id = Math.max(id, cell.id.length);
            if (details()) sala = Math.max(sala, cell.sala.length);
        };
        for (const { materia, turma } of currentPlano() ?? []) {
            for (const aula of turma.aulas) fit({ id: materia.id, sala: aula.sala });
        }
        for (const horas of Object.values(overlay()) as Record<string, HorarioCellOverlay | null>[]) {
            for (const cell of Object.values(horas)) if (cell) fit(cell);
        }
        const n = dias().length;
        return `calc(3.5em + ${n} * (max(${id}, ${sala} * 0.875) * (1ch - 0.025em) + 9px) + ${n + 2} * 2px)`;
    };

    return (
        <div class={clsx(props.class, fluid() && "overflow-x-auto")}>
            <table
                class={clsx(
                    "table-fixed border-separate",
                    "mx-auto",
                    fluid() && "w-full max-w-[540px]",
                    fluid() && (dias().length > 5 ? "text-[10px]" : "text-[11px]"),
                )}
                style={{
                    "--row": staged() ? `${stagedRow(props.stage!)}px` : undefined,
                    "min-width": fluid() && !underSheet() ? minWidth() : undefined,
                }}
            >
                <HorariosTableHead
                    showDetails={showDetails()}
                    onChangeShowDetails={setShowDetails}
                    toggle={!underSheet()}
                    staged={staged()}
                    dias={dias()}
                    fluid={fluid()}
                    colClass={colClass()}
                />
                <HorariosTableBody
                    showDetails={details()}
                    staged={staged()}
                    dias={dias()}
                    cellClass={clsx(colClass(), rowClass())}
                />
            </table>
        </div>
    );
}

function HorariosTableHead(props: {
    showDetails: boolean;
    onChangeShowDetails: (show: boolean) => void;
    toggle: boolean;
    staged: boolean;
    dias: Dia[];
    fluid: boolean;
    colClass: string;
}) {
    return (
        <thead>
            <tr>
                <th class={clsx("pr-1 whitespace-nowrap", !props.staged && "py-[5px]", props.fluid && "w-[3.5em]")}>
                    <Show when={props.toggle}>
                        <input
                            title="Mostrar salas..."
                            type="checkbox"
                            checked={props.showDetails}
                            onChange={(e) => props.onChangeShowDetails(e.currentTarget.checked)}
                            class="hit-area-3.5 mx-auto w-4 cursor-pointer align-middle"
                        />
                    </Show>
                </th>
                <For each={props.dias}>
                    {(dia) => (
                        <th
                            class={clsx(
                                props.colClass,
                                props.staged ? "h-(--row) py-0" : "py-1.5",
                                "rounded-sm border border-neutral-400 bg-neutral-100 font-normal text-neutral-700 shadow-xs",
                            )}
                        >
                            {props.fluid ? dia.short : dia.name}
                        </th>
                    )}
                </For>
            </tr>
        </thead>
    );
}

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

function HorariosTableBody(props: { showDetails: boolean; staged: boolean; dias: Dia[]; cellClass: string }) {
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
                                <td colSpan={props.dias.length + 1} />
                            </tr>
                        </Show>
                        <tr>
                            <td
                                class={clsx(
                                    "pr-[0.5em] tracking-tight whitespace-nowrap",
                                    props.staged ? "py-0" : props.showDetails ? "py-0.5" : "py-1.5",
                                )}
                            >
                                <p>{hora}</p>
                                <Show when={props.showDetails}>
                                    <p class="block text-[0.875em] leading-[calc(1.25em/0.875)] text-neutral-500">
                                        {HORAS_FIM[horaIndex()]}
                                    </p>
                                </Show>
                            </td>
                            <For each={props.dias}>
                                {(dia) => (
                                    <HorarioCell
                                        cellClass={props.cellClass}
                                        base={() => {
                                            const base = horarios()[dia.number]?.[hora] ?? undefined;
                                            const overlayId = overlayMateriaId();
                                            if (base && overlayId && base.id === overlayId) return undefined; // hide base if an overlay for that materia is active
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

interface HorarioCellBase {
    id: string;
    sala: string;
    color: string;
}

export interface HorarioCellOverlay {
    id: string;
    sala: string;
}

function HorarioCell(props: {
    base: () => HorarioCellBase | undefined;
    overlay: () => HorarioCellOverlay | undefined;
    showDetails?: boolean;
    cellClass: string;
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
            return prev.id === next.id && prev.sala === next.sala;
        },
    });

    const conflict = () => base() && overlay() && base()!.id !== overlay()!.id;

    // createEffect(() => {
    //     console.log("Overlay updated for position", props.position, ":", overlay());
    // });

    // createEffect(() => {
    //     console.log("Base updated for position", props.position, ":", base());
    // });

    return (
        <Switch fallback={<EmptyHorarioCell class={props.cellClass} />}>
            <Match when={conflict()}>
                <FilledHorarioCell
                    cellClass={props.cellClass}
                    title={overlay()!.id}
                    subtitle={props.showDetails ? overlay()!.sala : undefined}
                    class="bg-red-500"
                />
            </Match>
            <Match when={overlay()}>
                {(overlay) => (
                    <FilledHorarioCell
                        cellClass={props.cellClass}
                        title={overlay().id}
                        subtitle={props.showDetails ? overlay().sala : undefined}
                        class="bg-black text-white"
                    />
                )}
            </Match>
            <Match when={base()}>
                {(base) => (
                    <FilledHorarioCell
                        cellClass={props.cellClass}
                        title={base().id}
                        subtitle={props.showDetails ? base().sala : undefined}
                        style={base()?.color ? { "background-color": base().color } : undefined}
                    />
                )}
            </Match>
        </Switch>
    );
}

function EmptyHorarioCell(props: { class: string }) {
    return <td class={clsx("horario-item rounded-sm border border-neutral-500/80 bg-white", props.class)} />;
}

function FilledHorarioCell(props: {
    title: string;
    subtitle?: string;
    style?: JSX.CSSProperties;
    class?: string;
    cellClass: string;
}) {
    return (
        <td
            class={clsx(
                "horario-item rounded-sm border border-neutral-500/80 text-center",
                props.cellClass,
                props.class,
            )}
            style={props.style}
        >
            <p class="block w-full truncate text-center leading-none">{props.title}</p>
            <Show when={props.subtitle}>
                <p class="mt-1 block w-full truncate text-center text-[0.875em] leading-none tracking-tight">
                    {props.subtitle}
                </p>
            </Show>
        </td>
    );
}
