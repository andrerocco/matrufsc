import { describe, test } from "node:test";
import assert from "node:assert";
import { EMPTY_CATALOGO, buildCatalogo, searchEntries, suggestEntries } from "./catalogo";
import type { JSONTurma } from "~/data/schema";

const turma = (professores: string[]): JSONTurma => ["01208", 72, 40, 10, 0, 30, 0, [], professores, 208, null];

const catalogo = buildCatalogo({
    cursos: {
        "208": "CIÊNCIAS DA COMPUTAÇÃO",
        "3": "QUÍMICA - Bacharelado [Campus Florianópolis]",
        "226": "QUÍMICA - Bacharelado",
    },
    disciplinas: [
        ["MTM3100", "Pré-Cálculo", [turma(["Maria", "Ana Lúcia"]), turma(["Maria"])]],
        ["INE5404", "Programação", [turma([])]],
        ["INE5417", "Engenharia de Software I", [turma(["Jean Martina"])]],
    ],
});

const nomes = (entries: { nome: string }[]) => entries.map((entry) => entry.nome);

describe("catalogo", () => {
    test("lists the cursos as the CAGR names them, each professor once and the departamentos of the codes", () => {
        assert.deepStrictEqual(
            catalogo.curso.map(({ id, nome }) => [id, nome]),
            [
                ["208", "CIÊNCIAS DA COMPUTAÇÃO"],
                ["226", "QUÍMICA - Bacharelado"],
                ["3", "QUÍMICA - Bacharelado [Campus Florianópolis]"],
            ],
        );
        assert.deepStrictEqual(nomes(catalogo.professor), ["Ana Lúcia", "Jean Martina", "Maria"]);
        assert.deepStrictEqual(nomes(catalogo.departamento), ["INE", "MTM"]);
        assert.strictEqual(buildCatalogo(undefined), EMPTY_CATALOGO);
    });

    test("a value is found by the start of any of its words, in any order, without accents", () => {
        assert.deepStrictEqual(nomes(searchEntries("comp cien", catalogo.curso)), ["CIÊNCIAS DA COMPUTAÇÃO"]);
        assert.deepStrictEqual(nomes(searchEntries("lucia", catalogo.professor)), ["Ana Lúcia"]);
        assert.deepStrictEqual(searchEntries("putacao", catalogo.curso), []);
        assert.strictEqual(searchEntries(" ", catalogo.curso), catalogo.curso);
    });

    test("a suggestion follows the name word by word from its start, from three characters on", () => {
        assert.deepStrictEqual(nomes(suggestEntries("ciencias da comp", catalogo.curso)), ["CIÊNCIAS DA COMPUTAÇÃO"]);
        assert.deepStrictEqual(suggestEntries("computacao", catalogo.curso), []);
        assert.deepStrictEqual(suggestEntries("ci", catalogo.curso), []);
        assert.deepStrictEqual(suggestEntries("ciencias da computacao e mais", catalogo.curso), []);
    });
});
