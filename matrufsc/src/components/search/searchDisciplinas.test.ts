import { describe, test } from "node:test";
import assert from "node:assert";
import { buildCatalogo } from "./catalogo";
import { indexDisciplinas, searchDisciplinas, searchRows } from "./searchDisciplinas";
import { closedChip, editingChip, normalize, text, type Segment } from "./searchLine";
import type { JSONDisciplina, JSONTurma } from "~/data/schema";

const turma = (id: string, curso: number, professores: string[] = []): JSONTurma => [
    id,
    72,
    40,
    10,
    0,
    30,
    0,
    [],
    professores,
    curso,
    null,
];

const CURSOS = { "208": "CIÊNCIAS DA COMPUTAÇÃO", "238": "SISTEMAS DE INFORMAÇÃO (noturno)", "102": "FARMÁCIA" };

const DISCIPLINAS: JSONDisciplina[] = [
    [
        "INE5417",
        "Engenharia de Software I",
        [turma("05208", 208, ["Jean Martina"]), turma("05238", 238, ["Ana Lúcia"])],
    ],
    ["INE5404", "Programação Orientada a Objetos II", [turma("09208", 208), turma("02208", 208, ["Jean Martina"])]],
    ["MTM3100", "Pré-Cálculo", [turma("01208", 208), turma("09238", 238, ["Ana Lúcia"])]],
    ["INE5430", "Inteligência Artificial", [turma("12208A", 208), turma("11208B", 208)]],
    ["INE5999", "Tópicos Especiais", [turma("1018", 208)]],
    ["FAR1001", "Farmacologia", [turma("05102", 102, ["Maria"])]],
];

const index = indexDisciplinas(DISCIPLINAS);
const catalogo = buildCatalogo({ cursos: CURSOS, disciplinas: DISCIPLINAS });

describe("searchDisciplinas", () => {
    const codes = (query: string) => searchDisciplinas(query, index).map((d) => d[0]);

    test("empty query returns every disciplina", () => {
        assert.deepStrictEqual(searchDisciplinas("  ", index), DISCIPLINAS);
    });

    test("matches the name without accents", () => {
        assert.deepStrictEqual(codes("calculo"), ["MTM3100"]);
        assert.deepStrictEqual(codes("programacao objetos"), ["INE5404"]);
    });

    test("matches by code and by professor", () => {
        assert.deepStrictEqual(codes("ine54"), ["INE5417", "INE5404", "INE5430"]);
        assert.deepStrictEqual(codes("lucia"), ["INE5417", "MTM3100"]);
    });
});

describe("searchRows", () => {
    const CCO = closedChip("curso", { id: "208", nome: CURSOS["208"] });
    const SI = closedChip("curso", { id: "238", nome: CURSOS["238"] });
    const FAR = closedChip("curso", { id: "102", nome: CURSOS["102"] });
    const JEAN = closedChip("professor", { id: "Jean Martina", nome: "Jean Martina" });
    const ANA = closedChip("professor", { id: "Ana Lúcia", nome: "Ana Lúcia" });
    const INE = closedChip("departamento", { id: "INE", nome: "INE" });
    const choosing = (key: "curso" | "professor" | "departamento", value = "") => editingChip(key, value);

    const rows = (...parts: (string | Segment)[]) =>
        searchRows(normalize(parts.map((part) => (typeof part === "string" ? text(part) : part))), index, catalogo).map(
            (row) => (row.kind === "item" ? row.item[0] : `${row.key}:${row.value.nome}`),
        );

    test("without filters or text, every disciplina in the data order", () => {
        assert.deepStrictEqual(rows(), ["INE5417", "INE5404", "MTM3100", "INE5430", "INE5999", "FAR1001"]);
    });

    test("under a curso, its disciplinas come by the lowest fase among that curso's turmas, then by code", () => {
        assert.deepStrictEqual(rows(CCO), ["MTM3100", "INE5404", "INE5417", "INE5430", "INE5999"]);
        assert.deepStrictEqual(rows(SI), ["INE5417", "MTM3100"]);
    });

    test("chips of one key widen: a turma of any of the cursos is enough", () => {
        assert.deepStrictEqual(rows(SI, FAR), ["FAR1001", "INE5417", "MTM3100"]);
    });

    test("keys narrow each other, and curso with professor must hold on the same turma", () => {
        assert.deepStrictEqual(rows(CCO, JEAN), ["INE5404", "INE5417"]);
        assert.deepStrictEqual(rows(CCO, ANA), []);
        assert.deepStrictEqual(rows(INE, ANA), ["INE5417"]);
    });

    test("text beside chips scores as usual, inside what the chips leave", () => {
        assert.deepStrictEqual(rows(CCO, " calculo"), ["MTM3100"]);
        assert.deepStrictEqual(rows(FAR, " calculo"), []);
    });

    test("an open chip lists the values of its key that match what was typed", () => {
        assert.deepStrictEqual(rows(choosing("curso")), [
            "curso:CIÊNCIAS DA COMPUTAÇÃO",
            "curso:FARMÁCIA",
            "curso:SISTEMAS DE INFORMAÇÃO (noturno)",
        ]);
        assert.deepStrictEqual(rows("calculo ", choosing("curso", "info sist")), [
            "curso:SISTEMAS DE INFORMAÇÃO (noturno)",
        ]);
    });

    test("an open chip offers only what the chips of the other keys leave reachable", () => {
        assert.deepStrictEqual(rows(CCO, choosing("professor")), ["professor:Jean Martina"]);
        assert.deepStrictEqual(rows(ANA, choosing("curso")), ["curso:SISTEMAS DE INFORMAÇÃO (noturno)"]);
        assert.deepStrictEqual(rows(FAR, choosing("departamento")), ["departamento:FAR"]);
        assert.deepStrictEqual(rows(CCO, choosing("curso", "farm")), ["curso:FARMÁCIA"]);
    });

    test("free text suggests a curso from the start of its name, ahead of the disciplinas", () => {
        assert.deepStrictEqual(rows("farm"), ["curso:FARMÁCIA", "FAR1001"]);
        assert.deepStrictEqual(rows(FAR, " farm"), ["FAR1001"]);
    });

    test("a departamento is suggested only by its exact code, a professor from two words on", () => {
        assert.deepStrictEqual(rows("in"), ["INE5430", "INE5417", "INE5404", "INE5999"]);
        assert.deepStrictEqual(rows("ine").slice(0, 2), ["departamento:INE", "INE5417"]);
        assert.deepStrictEqual(rows("jean"), ["INE5417", "INE5404"]);
        assert.deepStrictEqual(rows("jean mar"), ["professor:Jean Martina", "INE5417", "INE5404"]);
        assert.deepStrictEqual(rows(FAR, " jean mar"), []);
    });

    test("at most three suggestions", () => {
        const engenharias = buildCatalogo({
            cursos: { "1": "ENGENHARIA A", "2": "ENGENHARIA B", "3": "ENGENHARIA C", "4": "ENGENHARIA D" },
            disciplinas: [],
        });
        assert.strictEqual(searchRows([text("eng")], [], engenharias).length, 3);
    });
});
