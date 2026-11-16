import { describe, test } from "node:test";
import assert from "node:assert";
import { disciplinaNome, materiaNome } from "./nomeCompleto";
import { getDisciplinaFromJSON } from "~/data/parse";
import type { JSONDisciplina, JSONTurma } from "~/data/schema";

const CURSOS = { "208": "CIÊNCIAS DA COMPUTAÇÃO", "606": "ENGENHARIA NAVAL [Campus Joinville]" };

const turma = (id: string, curso: number, status: string | null = null): JSONTurma => [
    id,
    72,
    40,
    10,
    0,
    30,
    0,
    [],
    [],
    curso,
    status,
];

const nomes = (turmas: JSONTurma[]) => {
    const disciplina: JSONDisciplina = ["MTM3110", "Cálculo 1", turmas];
    return [disciplinaNome(disciplina, CURSOS), materiaNome(getDisciplinaFromJSON(disciplina, "FLO", "20271", CURSOS))];
};

describe("nome completo", () => {
    test("the curso every turma shares goes after the name, as the CAGR names it", () => {
        const nome = "Cálculo 1 *ENGENHARIA NAVAL [Campus Joinville]";
        assert.deepStrictEqual(nomes([turma("01606", 606), turma("02606", 606)]), [nome, nome]);
    });

    test("a disciplina offered to more than one curso names none", () => {
        assert.deepStrictEqual(nomes([turma("01208", 208), turma("01606", 606)]), ["Cálculo 1", "Cálculo 1"]);
    });

    test("the status every turma shares goes before the curso, and a status of only some turmas stays off", () => {
        const cancelada = "Cálculo 1 [Cancelada] *CIÊNCIAS DA COMPUTAÇÃO";
        assert.deepStrictEqual(nomes([turma("01208", 208, "Cancelada")]), [cancelada, cancelada]);
        assert.deepStrictEqual(
            nomes([turma("01208", 208, "Cancelada"), turma("02208", 208)])[0],
            "Cálculo 1 *CIÊNCIAS DA COMPUTAÇÃO",
        );
    });
});
