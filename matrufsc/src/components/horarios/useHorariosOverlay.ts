import { createSignal } from "solid-js";
import { HORAS, type HorarioCellOverlay, type HorariosDescriptor } from "./Horarios";
import { usePlano, type Materia, type Turma } from "~/context/plano/Plano.store";

const [overlay, setOverlay] = createSignal<HorariosDescriptor<HorarioCellOverlay>>({});

function overlayMateria(materia: Materia) {
    const { currentPlano } = usePlano();

    const overlayDescriptor: HorariosDescriptor<HorarioCellOverlay> = {};

    // Se a matéria ta no plano, a matéria selecionada é {materia} = currentPlano.find...
    if (currentPlano()) {
        const planoEntry = currentPlano().find((entry) => entry.materia.id === materia.id);

        let turma: Turma;

        if (planoEntry) {
            // Se a matéria está no plano atual (não bloqueada e selecionada), usa a turma do plano atual
            turma = planoEntry.turma;
        } else {
            // Se a matéria não está no plano atual (bloqueada ou não selecionada), usa a primeira turma selecionada
            const firstSelectedTurma = materia.turmas.find((t) => t.selected);
            if (!firstSelectedTurma) return;
            turma = firstSelectedTurma;
        }

        for (const aula of turma.aulas) {
            for (const horaIndex of aula.horarios) {
                if (!overlayDescriptor[aula.dia_semana]) overlayDescriptor[aula.dia_semana] = {};
                overlayDescriptor[aula.dia_semana][HORAS[horaIndex]] = { id: materia.id };
            }
        }
    }

    setOverlay(overlayDescriptor);
}

function overlayTurma(materiaId: string, turma: Turma) {
    const overlayDescriptor: HorariosDescriptor<HorarioCellOverlay> = {};

    for (const aula of turma.aulas) {
        for (const horaIndex of aula.horarios) {
            if (!overlayDescriptor[aula.dia_semana]) overlayDescriptor[aula.dia_semana] = {};
            overlayDescriptor[aula.dia_semana][HORAS[horaIndex]] = { id: materiaId };
        }
    }

    setOverlay(overlayDescriptor);
}

function clearOverlay() {
    setOverlay({});
}

export const useHorariosOverlay = () => ({
    overlay,
    overlayMateria,
    overlayTurma,
    clearOverlay,
});
