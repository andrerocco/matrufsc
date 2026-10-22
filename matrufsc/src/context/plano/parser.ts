/// Parses the JSON data into objects used by the app.

import type { JSONCampus, JSONDisciplina, JSONTurma } from "~/lib/campusDataQuery";
import type { Curso, Materia, Turma } from "~/context/plano/Plano.store";
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

export type JSONCursos = NonNullable<JSONCampus["cursos"]>;

// Legacy files have neither the turma's curso field nor the campus `cursos` map, and the
// scraper gate rejects a curso id missing from the map, so an unresolvable id means "no curso".
export function getCursoFromJSON(cursoId: number | null | undefined, cursos?: JSONCursos): Curso | null {
    if (cursoId == null) return null;
    const nome = cursos?.[String(cursoId)];
    return nome ? { id: cursoId, nome } : null;
}

export function getTurmaFromJSON(json: JSONTurma, cursos?: JSONCursos): Turma {
    const [id, carga_horaria, vagas_ofertadas, vagas_ocupadas, _, __, ___, rawAulas, professores, cursoId] = json;

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
        curso: getCursoFromJSON(cursoId, cursos),
        selected: true,
    };
}

export function getDisciplinaFromJSON(
    json: JSONDisciplina,
    campus: string,
    semester: string,
    cursos?: JSONCursos,
): Materia {
    const [id, _, nome, rawTurmas] = json;

    const turmas = rawTurmas.map((turma) => getTurmaFromJSON(turma, cursos));

    return { id, nome, campus, semester, turmas, selected: true };
}

export type { JSONTurma, JSONDisciplina } from "~/lib/campusDataQuery";
