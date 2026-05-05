import { createEffect } from "solid-js";
import { usePlano } from "~/context/plano/Plano.store";

const DEFAULT_PAGE_TITLE = "MatrUFSC";
const TITLE_MATERIA_LIMIT = 2;

export default function MetaTitle() {
    const { materias, planos, currentPlanoIndex, focusedMateriaId } = usePlano();

    createEffect(() => {
        document.title = getMetaTitle(
            materias.map((materia) => materia.id),
            focusedMateriaId(),
            currentPlanoIndex(),
            planos().length,
        );
    });

    return null;
}

function getMetaTitle(
    materiaIds: readonly string[],
    focusedMateriaId: string | null,
    currentPlanoIndex: number,
    totalPlanos: number,
): string {
    if (materiaIds.length === 0) return DEFAULT_PAGE_TITLE;

    const orderedMateriaIds =
        focusedMateriaId && materiaIds.includes(focusedMateriaId)
            ? [focusedMateriaId, ...materiaIds.filter((id) => id !== focusedMateriaId)]
            : materiaIds;
    const visibleMateriaIds = orderedMateriaIds.slice(0, TITLE_MATERIA_LIMIT);
    const hiddenMateriaCount = Math.max(0, orderedMateriaIds.length - visibleMateriaIds.length);
    const materiasLabel = `${visibleMateriaIds.join(", ")}${hiddenMateriaCount > 0 ? ` +${hiddenMateriaCount}` : ""}`;
    const combinacaoLabel = totalPlanos > 1 ? ` (${currentPlanoIndex + 1}/${totalPlanos})` : "";

    return `${materiasLabel}${combinacaoLabel} · ${DEFAULT_PAGE_TITLE}`;
}
