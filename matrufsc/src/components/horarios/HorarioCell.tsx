import { cn } from "~/lib/utils";

export interface HorarioCellBase {
    id: string;
    sala: string;
    color: string;
}

export interface HorarioCellOverlay {
    id: string;
    sala?: string; // Adicionado para exibir o texto do compromisso
    color?: string; // Adicionado para permitir cores personalizadas
}

export default function HorarioCell({ base, overlay }: { base?: HorarioCellBase; overlay?: HorarioCellOverlay }) {
    const conflict = base && overlay;

    if (overlay) {
        return (
            <td
                data-materia-id={overlay.id}
                className={cn(
                    "horario-item w-[80px] h-[30px] rounded border border-neutral-500/80 px-1 py-[5px]",
                    conflict ? "bg-red-600" : "bg-black text-white",
                )}
                style={{ backgroundColor: overlay.color || (conflict ? "red" : "black") }}
                align="center"
            >
                <p className="block w-full truncate text-center leading-none">
                    {overlay.sala || overlay.id}
                </p>
            </td>
        );
    }

    if (!base) {
        return <td className="horario-item w-[80px] h-[30px] rounded border border-neutral-500/80 bg-white px-1 py-[5px]" />;
    }

    return (
        <td
            data-materia-id={base.id}
            className="horario-item w-[80px] h-[30px] rounded border border-neutral-500/80 bg-white px-1 py-[5px]"
            style={{ backgroundColor: base.color }}
            align="center"
        >
            <p className="block w-full truncate text-center leading-none">{base.id}</p>
        </td>
    );
}
