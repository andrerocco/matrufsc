/// Parses the JSON data into objects used by the app.

import type { JSONDisciplina, JSONTurma } from "~/context/campusData/types";
import type { Materia, Turma } from "~/context/plano/Plano.store";
import { HORAS } from "~/context/plano/constants";

function getHorarioList(horarioInicio: string, creditos: number): number[] {
    const horarioInicioIndex = HORAS.indexOf(horarioInicio);

    if (horarioInicioIndex === -1) {
        throw new Error(`Invalid horarioInicio: ${horarioInicio}.`);
    }

    const horarioFimIndex = horarioInicioIndex + creditos - 1;

    if (horarioFimIndex >= HORAS.length) {
        throw new Error(`Sum of horarioInicio and creditos is out of bounds: ${horarioInicio}, ${creditos}.`);
    }

    return Array.from({ length: creditos }, (_, i) => horarioInicioIndex + i);
}

export function getTurmaFromJSON(json: JSONTurma): Turma {
    const [id, carga_horaria, vagas_ofertadas, vagas_ocupadas, _, __, ___, rawAulas, professores] = json;

    // Converts "3.1620-3 / CTS-SL114A" to dia_semana: 3, horarios: [12, 13, 14], sala: "CTS-SL114A"
    const aulas = rawAulas.map((rawAula) => {
        const [info, sala] = rawAula.split(" / ");
        const [dia_semana, info2] = info.split(".");
        const [horario_inicio, aulas] = info2.split("-");

        return {
            dia_semana: Number(dia_semana),
            horarios: getHorarioList(horario_inicio, Number(aulas)),
            sala: sala,
        };
    });
    return {
        id,
        carga_horaria,
        vagas_ofertadas,
        vagas_ocupadas,
        aulas,
        professores,
        selected: true,
    };
}

export function getDisciplinaFromJSON(json: JSONDisciplina): Materia {
    const [id, _, nome, rawTurmas] = json;

    const turmas = rawTurmas.map(getTurmaFromJSON);

    return { id, nome, turmas, selected: true }; // TODO: Make cor optional
}

export type { JSONTurma, JSONDisciplina } from "~/context/campusData/types";
