import type { JSONCursos, JSONDisciplina } from "~/data/schema";
import type { Materia } from "~/data/types";

// The CAGR prints a disciplina as "Nome [Status] *CURSO", read off its first turma. Status and curso belong to
// each turma, so each goes on the name only when every turma shares it.
function nomeCompleto(nome: string, turmas: { curso: string; status: string | null }[]): string {
    const shared = <T>(values: T[]) => (new Set(values).size === 1 ? values[0] : null);
    const status = shared(turmas.map((turma) => turma.status));
    const curso = shared(turmas.map((turma) => turma.curso));
    return `${nome}${status ? ` [${status}]` : ""}${curso ? ` *${curso}` : ""}`;
}

export function disciplinaNome([, nome, turmas]: JSONDisciplina, cursos: JSONCursos): string {
    return nomeCompleto(
        nome,
        turmas.map((turma) => ({ curso: cursos[String(turma[9])], status: turma[10] })),
    );
}

export function materiaNome(materia: Materia): string {
    return nomeCompleto(
        materia.nome,
        materia.turmas.map((turma) => ({ curso: turma.curso.nome, status: turma.status })),
    );
}
