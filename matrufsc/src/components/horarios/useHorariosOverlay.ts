import { createEffect, createMemo, createRoot, createSignal, onCleanup } from "solid-js";
import { mergeEquivalentTurmas } from "~/context/plano/combinacoes";
import { getDisciplinaFromJSON, type JSONDisciplina } from "~/context/plano/parser";
import { usePlano, type Materia, type Turma } from "~/context/plano/Plano.store";
import type { HorariosDescriptor, HorarioCellOverlay } from "./types";
import { HORAS } from "./constants";

type OverlayResolved = { materiaId: string; turma: Turma };

type SearchOverlayData = {
    materiaId: string;
    turmas: Turma[];
};

function turmaToOverlayDescriptor(materiaId: string, turma: Turma): HorariosDescriptor<HorarioCellOverlay> {
    const horarios: HorariosDescriptor<HorarioCellOverlay> = {};

    for (const aula of turma.aulas) {
        for (const hora of aula.horarios) {
            if (!horarios[aula.dia_semana]) {
                horarios[aula.dia_semana] = {};
            }

            horarios[aula.dia_semana]![HORAS[hora]] = {
                id: materiaId,
                turmaId: turma.id,
                sala: aula.sala,
            };
        }
    }

    return horarios;
}

const overlayStore = createRoot(() => {
    const [materiaOverlayId, setMateriaOverlayId] = createSignal<string | null>(null);
    const [turmaOverlay, setTurmaOverlay] = createSignal<{ materiaId: string; turma: Turma } | null>(null);
    const [searchOverlayData, setSearchOverlayData] = createSignal<SearchOverlayData | null>(null);
    const [searchCycleIndex, setSearchCycleIndex] = createSignal(0);
    const [horarioHover, setHorarioHover] = createSignal<{ materiaId: string; turmaId: string } | null>(null);

    const { currentPlano } = usePlano();

    const pointerOverlay = createMemo<OverlayResolved | null>(() => {
        const turma = turmaOverlay();
        if (turma) return { materiaId: turma.materiaId, turma: turma.turma };

        const materiaId = materiaOverlayId();
        if (!materiaId) return null;

        const plano = currentPlano();
        const match = plano?.find((item) => item.materia.id === materiaId);
        if (!match) return null;

        return { materiaId: match.materia.id, turma: match.turma };
    });

    const searchOverlay = createMemo<OverlayResolved | null>(() => {
        const data = searchOverlayData();
        if (!data || data.turmas.length === 0) return null;

        const index = Math.max(0, Math.min(searchCycleIndex(), data.turmas.length - 1));
        return { materiaId: data.materiaId, turma: data.turmas[index] };
    });

    const activeOverlay = createMemo<OverlayResolved | null>(() => pointerOverlay() ?? searchOverlay());

    const overlayMateriaIdSignal = createMemo(() => activeOverlay()?.materiaId ?? null);

    const overlaySignal = createMemo<HorariosDescriptor<HorarioCellOverlay>>(() => {
        const source = activeOverlay();
        if (!source) return {};

        return turmaToOverlayDescriptor(source.materiaId, source.turma);
    });

    createEffect(() => {
        const data = searchOverlayData();
        if (!data) {
            setSearchCycleIndex(0);
            return;
        }

        const total = data.turmas.length;
        if (total <= 1) {
            setSearchCycleIndex(0);
            return;
        }

        setSearchCycleIndex(0);
        const timer = setInterval(() => {
            setSearchCycleIndex((current) => (current + 1) % total);
        }, 1500);

        onCleanup(() => clearInterval(timer));
    });

    function overlayMateria(materia: Materia) {
        setTurmaOverlay(null);
        setMateriaOverlayId(materia.id);
    }

    function overlayTurma(materia: Materia, turma: Turma) {
        setMateriaOverlayId(null);
        setTurmaOverlay({ materiaId: materia.id, turma });
    }

    function clearOverlay() {
        setMateriaOverlayId(null);
        setTurmaOverlay(null);
    }

    function setSearchOverlay(disciplina: JSONDisciplina | null) {
        if (!disciplina) {
            setSearchOverlayData(null);
            return;
        }

        const materia = getDisciplinaFromJSON(disciplina);
        const grouped = mergeEquivalentTurmas(materia.turmas);
        const turmas = Object.values(grouped).map((group) => group[0]);

        setSearchOverlayData({ materiaId: materia.id, turmas });
    }

    function clearSearchOverlay() {
        setSearchOverlayData(null);
    }

    function hoverHorarioCell(materiaId: string, turmaId: string) {
        setHorarioHover({ materiaId, turmaId });
    }

    function clearHorarioHover() {
        setHorarioHover(null);
    }

    const hoveredMateriaIdSignal = createMemo(() => horarioHover()?.materiaId ?? null);
    const hoveredTurmaIdSignal = createMemo(() => horarioHover()?.turmaId ?? null);

    return {
        overlay: overlaySignal,
        overlayMateriaId: overlayMateriaIdSignal,
        overlayMateria,
        overlayTurma,
        clearOverlay,
        setSearchOverlay,
        clearSearchOverlay,
        hoverHorarioCell,
        clearHorarioHover,
        hoveredMateriaId: hoveredMateriaIdSignal,
        hoveredTurmaId: hoveredTurmaIdSignal,
    };
});

export const useHorariosOverlay = () => overlayStore;
