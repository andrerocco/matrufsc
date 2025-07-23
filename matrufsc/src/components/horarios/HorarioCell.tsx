import { cn } from "~/lib/utils";

export interface HorarioCellBase {
    id: string;
    sala: string;
    color: string;
}

export interface HorarioCellOverlay {
    id: string;
}

export default function HorarioCell({ base, overlay }: { base?: HorarioCellBase; overlay?: HorarioCellOverlay }) {
    const conflict = base && overlay;

    if (overlay) {
        return (
            <td
                data-materia-id={overlay.id}
                className={cn(
                    "horario-item h-[30px] w-[80px] rounded border border-neutral-500/80 px-1 py-[5px]",
                    conflict ? "bg-red-600" : "bg-black text-white",
                )}
                align="center"
            >
                <p className="block w-full truncate text-center leading-none">{overlay.id}</p>
            </td>
        );
    }

    if (!base) {
        return (
            <td className="horario-item h-[30px] w-[80px] rounded border border-neutral-500/80 bg-white px-1 py-[5px]" />
        );
    }

    return (
        <td
            data-materia-id={base.id}
            className="horario-item h-[30px] w-[80px] rounded border border-neutral-500/80 bg-white px-1 py-[5px]"
            style={{ backgroundColor: base.color }}
            align="center"
        >
            <p className="block w-full truncate text-center leading-none">{base.id}</p>
        </td>
    );
}
