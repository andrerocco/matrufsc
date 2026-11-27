import { HORAS, type JSONCampus, type JSONCursos, type JSONDisciplina, type JSONTurma } from "./schema";
import type { Aula, Curso, Materia, Turma } from "./types";

// "3.1620-3 / CTS-SL114A": dia da semana, horário da primeira aula, número de aulas seguidas e sala.
// Domingo (1) é recusado porque a grade não tem essa coluna.
const AULA_RE = /^([2-7])\.(\d{4})-([1-9]\d*) \/ (.+)$/;

// Posições 1 a 6 da tupla da turma.
const NUMERIC_FIELDS = [
    "carga horária",
    "vagas ofertadas",
    "vagas ocupadas",
    "alunos especiais",
    "saldo de vagas",
    "pedidos sem vaga",
];

const isText = (value: unknown): value is string => typeof value === "string" && value !== "";
const isStringList = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((item) => typeof item === "string");
const show = (value: unknown) => JSON.stringify(value);

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
    if (!Number.isInteger(id)) throw new Error(`Curso ${show(id)} is not an integer.`);
    const nome = cursos[String(id)];
    if (nome === undefined) {
        throw new Error(`Curso ${id} is not in cursos.`);
    }
    if (!isText(nome)) throw new Error(`Curso ${id} is named ${show(nome)}, expected a non-empty string.`);
    return { id, nome };
}

export function getTurmaFromJSON(json: JSONTurma, cursos: JSONCursos): Turma {
    if (!Array.isArray(json)) throw new Error(`Turma ${show(json)} is not a list.`);
    if (json.length !== 11) throw new Error(`Turma ${json[0]} has ${json.length} fields, expected 11.`);

    const [id, carga_horaria, vagas_ofertadas, vagas_ocupadas, _, __, ___, rawAulas, professores, cursoId, status] =
        json;

    if (!isText(id)) throw new Error(`Turma id ${show(id)} is not a non-empty string.`);
    NUMERIC_FIELDS.forEach((name, index) => {
        const value = json[index + 1];
        if (!Number.isInteger(value)) throw new Error(`Turma ${id}: ${name} ${show(value)} is not an integer.`);
    });
    if (!isStringList(rawAulas)) throw new Error(`Turma ${id}: horários ${show(rawAulas)} is not a list of strings.`);
    if (!isStringList(professores)) {
        throw new Error(`Turma ${id}: professores ${show(professores)} is not a list of strings.`);
    }
    if (status !== null && !isText(status)) {
        throw new Error(`Turma ${id}: status ${show(status)} is neither null nor a non-empty string.`);
    }

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
    if (!Array.isArray(json)) throw new Error(`Disciplina ${show(json)} is not a list.`);
    if (json.length !== 3) throw new Error(`Disciplina ${json[0]} has ${json.length} fields, expected 3.`);

    const [id, nome, rawTurmas] = json;

    if (!isText(id)) throw new Error(`Disciplina code ${show(id)} is not a non-empty string.`);
    if (!isText(nome)) throw new Error(`Disciplina ${id}: nome ${show(nome)} is not a non-empty string.`);
    if (!Array.isArray(rawTurmas) || rawTurmas.length === 0) throw new Error(`Disciplina ${id} has no turmas.`);

    const turmas = rawTurmas.map((turma) => getTurmaFromJSON(turma, cursos));

    const turmaIds = new Set<string>();
    for (const turma of turmas) {
        if (turmaIds.has(turma.id)) throw new Error(`Disciplina ${id} lists turma ${turma.id} more than once.`);
        turmaIds.add(turma.id);
    }

    return { id, nome, campus, semester, turmas, selected: true };
}

// Devolve as tuplas como vieram: o site as guarda assim e só monta a matéria quando ela é adicionada.
export function checkCampusJSON(json: JSONCampus): JSONCampus {
    for (const disciplina of json.disciplinas) getDisciplinaFromJSON(disciplina, json.campus, "", json.cursos);
    return json;
}
