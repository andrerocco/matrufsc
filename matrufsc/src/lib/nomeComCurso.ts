import type { JSONCursos, JSONDisciplina } from "~/context/plano/parser";
import type { Materia } from "~/context/plano/Plano.store";

// The CAGR lists a disciplina as "Nome *CURSO" and users read it that way for years. The scraper moved the
// curso to each turma, so the first turma's curso brings the suffix back on screen.
export function nomeComCurso(nome: string, curso: string | undefined): string {
    return curso ? `${nome} *${curso}` : nome;
}

export function disciplinaNome(disciplina: JSONDisciplina, cursos?: JSONCursos): string {
    const cursoId = disciplina[3].find((turma) => turma[9] != null)?.[9];
    return nomeComCurso(disciplina[2], cursoId == null ? undefined : cursos?.[String(cursoId)]);
}

export function materiaNome(materia: Materia): string {
    return nomeComCurso(materia.nome, materia.turmas.find((turma) => turma.curso)?.curso?.nome);
}
