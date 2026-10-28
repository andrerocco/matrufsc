import { HORAS, type JSONCursos, type JSONDisciplina, type JSONTurma } from "./schema";
import type { Aula, Curso, Materia, Turma } from "./types";

// "3.1620-3 / CTS-SL114A": dia da semana, horário da primeira aula, número de aulas seguidas e sala.
const AULA_RE = /^([1-7])\.(\d{4})-([1-9]\d*) \/ (.+)$/;

function getAulaFromJSON(raw: string): Aula {
    const match = AULA_RE.exec(raw);
    if (!match) throw new Error(`Aula "${raw}" is not in the format dia.HHMM-N / sala.`);
    const [, dia, horarioInicio, aulas, sala] = match;

    const inicio = HORAS.indexOf(horarioInicio);
    if (inicio === -1) throw new Error(`Aula "${raw}" starts at ${horarioInicio}, which is not in HORAS.`);
    const creditos = Number(aulas);
    if (inicio + creditos > HORAS.length) throw new Error(`Aula "${raw}" ends after the last horário in HORAS.`);

    return { dia_semana: Number(dia), horarios: Array.from({ length: creditos }, (_, i) => inicio + i), sala };
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

    return {
        id,
        carga_horaria,
        vagas_ofertadas,
        vagas_ocupadas,
        aulas: rawAulas.map(getAulaFromJSON),
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
