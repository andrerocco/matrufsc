/// Parses the JSON data into objects used by the app.

import type { JSONCursos, JSONDisciplina, JSONTurma } from "./schema";
import type { Curso, Materia, Turma } from "./types";
import { HORAS } from "./constants";

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

function getCurso(id: number, cursos: JSONCursos): Curso {
    const nome = cursos[String(id)];
    if (nome === undefined) {
        throw new Error(`Curso ${id} is not in cursos.`);
    }
    return { id, nome };
}

export function getTurmaFromJSON(json: JSONTurma, cursos: JSONCursos): Turma {
    if (json.length !== 11) throw new Error(`Turma ${json[0]} has ${json.length} fields, expected 11.`);

    const [id, carga_horaria, vagas_ofertadas, vagas_ocupadas, _, __, ___, rawAulas, professores, cursoId, status] =
        json;

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
        curso: getCurso(cursoId, cursos),
        status,
        selected: true,
    };
}

export function getDisciplinaFromJSON(
    json: JSONDisciplina,
    campus: string,
    semester: string,
    cursos: JSONCursos,
): Materia {
    if (json.length !== 3) throw new Error(`Disciplina ${json[0]} has ${json.length} fields, expected 3.`);

    const [id, nome, rawTurmas] = json;

    const turmas = rawTurmas.map((turma) => getTurmaFromJSON(turma, cursos));

    return { id, nome, campus, semester, turmas, selected: true };
}
