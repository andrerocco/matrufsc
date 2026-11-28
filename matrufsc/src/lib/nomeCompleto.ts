import type { JSONCursos, JSONDisciplina } from "~/data/schema";
import type { Materia } from "~/data/types";

// The CAGR prints a disciplina as "Nome [Status] *CURSO", read off its first turma, and the name keeps that
// turma's curso, as users always read it. The status goes on the name only when every turma shares it.
function nomeCompleto(nome: string, turmas: { curso: string; status: string | null }[]): string {
    const [{ curso, status }] = turmas;
    const shared = turmas.every((turma) => turma.status === status);
    return `${nome}${status && shared ? ` [${status}]` : ""} *${curso}`;
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
