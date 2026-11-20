import { describe, test } from "node:test";
import assert from "node:assert";
import { indexDisciplinas, searchDisciplinas } from "./searchDisciplinas";
import type { JSONDisciplina, JSONTurma } from "~/data/schema";

const turma = (professores: string[]): JSONTurma => ["01208", 72, 50, 10, 0, 40, 0, [], professores, 208, null];

const DISCIPLINAS: JSONDisciplina[] = [
    ["EMB5001", "Introdução à Engenharia", [turma(["Ana Lúcia"])]],
    ["EMB5002", "Cálculo I", [turma(["José"])]],
    ["MAT1000", "Cálculo II", [turma(["Maria"])]],
];

describe("searchDisciplinas", () => {
    const index = indexDisciplinas(DISCIPLINAS);

    test("empty query returns every disciplina", () => {
        assert.deepStrictEqual(searchDisciplinas("  ", index), DISCIPLINAS);
    });

    test("matches the name without accents", () => {
        assert.deepStrictEqual(
            searchDisciplinas("calculo", index).map((d) => d[0]),
            ["EMB5002", "MAT1000"],
        );
        assert.deepStrictEqual(
            searchDisciplinas("introducao engenharia", index).map((d) => d[0]),
            ["EMB5001"],
        );
    });

    test("matches by code and by professor", () => {
        assert.deepStrictEqual(
            searchDisciplinas("emb", index).map((d) => d[0]),
            ["EMB5001", "EMB5002"],
        );
        assert.deepStrictEqual(
            searchDisciplinas("lucia", index).map((d) => d[0]),
            ["EMB5001"],
        );
    });
});
