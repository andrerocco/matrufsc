import { cn } from "~/lib/classnames";
import { Show } from "solid-js";

export interface HorarioCellBase {
    id: string;
    sala: string;
    color: string;
}

export interface HorarioCellOverlay {
    id: string;
}

export default function HorarioCell(props: { base?: HorarioCellBase; overlay?: HorarioCellOverlay }) {
    return (
        <Show
            when={!props.overlay}
            fallback={
                <td
                    data-materia-id={props.overlay!.id}
                    class={cn(
                        "horario-item h-[30px] w-[80px] rounded border border-neutral-500/80 px-1 py-[5px]",
                        props.base && props.overlay ? "bg-red-600" : "bg-black text-white",
                    )}
                    align="center"
                >
                    <p class="block w-full truncate text-center leading-none">{props.overlay!.id}</p>
                </td>
            }
        >
            <Show
                when={props.base}
                fallback={
                    <td class="horario-item h-[30px] w-[80px] rounded border border-neutral-500/80 bg-white px-1 py-[5px]" />
                }
            >
                <td
                    data-materia-id={props.base!.id}
                    class="horario-item h-[30px] w-[80px] rounded border border-neutral-500/80 bg-white px-1 py-[5px]"
                    style={{ "background-color": props.base!.color }}
                    align="center"
                >
                    <p class="block w-full truncate text-center leading-none">{props.base!.id}</p>
                </td>
            </Show>
        </Show>
    );
}
