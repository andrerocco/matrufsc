import { describe, test } from "node:test";
import assert from "node:assert";
import type { JSONDisciplina, JSONTurma } from "~/lib/campusDataQuery";
import { EMPTY_CATALOGO, buildCatalogo } from "~/components/search/catalogo";
import {
    filterDisciplinas,
    searchRows,
    sortDisciplinasByFase,
    type Filtro,
} from "~/components/search/searchDisciplinas";
import { closedChip, editingChip, normalize, text, type Segment } from "~/components/search/searchLine";

const turma = (id: string, curso: number | null, professores: string[] = []): JSONTurma => [
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
];

const disc = (code: string, nome: string, turmas: JSONTurma[]): JSONDisciplina => [
    code,
    nome.toUpperCase(),
    nome,
    turmas,
];

const CURSOS = { "208": "CIÊNCIAS DA COMPUTAÇÃO", "238": "SISTEMAS DE INFORMAÇÃO (noturno)", "102": "FARMÁCIA" };

const DATA: JSONDisciplina[] = [
    disc("INE5417", "Engenharia de Software I", [
        turma("05208", 208, ["Jean Martina"]),
        turma("05238", 238, ["Ana Paula"]),
    ]),
    disc("INE5404", "Programação Orientada a Objetos II", [turma("02208", 208, ["Jean Martina"])]),
    disc("MTM3100", "Pré-Cálculo", [turma("01208", 208), turma("01238", 238, ["Ana Paula"])]),
    disc("INE5430", "Inteligência Artificial", [turma("07208A", 208), turma("08208B", 208)]),
    disc("INE5999", "Tópicos Especiais", [turma("TE208", 208)]),
    disc("INE5998", "Tópicos Avançados", [turma("XX208", 208)]),
    disc("FAR1001", "Farmacologia", [turma("03102", 102, ["Maria"])]),
];
const catalogo = buildCatalogo({ cursos: CURSOS, disciplinas: DATA });

const ids = (...values: string[]) => new Set(values);
const filtro = (parts: Partial<Record<keyof Filtro, string[]>>): Filtro => ({
    curso: ids(...(parts.curso ?? [])),
    professor: ids(...(parts.professor ?? [])),
    departamento: ids(...(parts.departamento ?? [])),
});
const CCO = closedChip("curso", { id: "208", nome: "CCO" });
const SI = closedChip("curso", { id: "238", nome: "SI" });
const FAR = closedChip("curso", { id: "102", nome: "FARMÁCIA" });
const JEAN = closedChip("professor", { id: "Jean Martina", nome: "Jean Martina" });
const ANA = closedChip("professor", { id: "Ana Paula", nome: "Ana Paula" });
const INE = closedChip("departamento", { id: "INE", nome: "INE" });
const segments = (...parts: (string | Segment)[]) =>
    normalize(parts.map((part) => (typeof part === "string" ? text(part) : part)));
const rowsOf = (...parts: (string | Segment)[]) => searchRows(segments(...parts), DATA, catalogo);

const codes = (rows: ReturnType<typeof searchRows>) =>
    rows.map((row) => (row.kind === "item" ? row.item[0] : `${row.key}:${row.value.nome}`));
const codesOf = (list: JSONDisciplina[]) => list.map((d) => d[0]);

describe("search disciplinas with filters", () => {
    describe("filterDisciplinas", () => {
        test("cursos: disciplinas with at least one turma of any of them", () => {
            assert.deepStrictEqual(codesOf(filterDisciplinas(DATA, filtro({ curso: ["238"] }))), [
                "INE5417",
                "MTM3100",
            ]);
            assert.deepStrictEqual(codesOf(filterDisciplinas(DATA, filtro({ curso: ["238", "102"] }))), [
                "INE5417",
                "MTM3100",
                "FAR1001",
            ]);
            assert.deepStrictEqual(filterDisciplinas(DATA, filtro({ curso: ["999"] })), []);
        });

        test("professores: disciplinas with at least one turma by any of them", () => {
            assert.deepStrictEqual(codesOf(filterDisciplinas(DATA, filtro({ professor: ["Ana Paula"] }))), [
                "INE5417",
                "MTM3100",
            ]);
            assert.deepStrictEqual(codesOf(filterDisciplinas(DATA, filtro({ professor: ["Jean Martina", "Maria"] }))), [
                "INE5417",
                "INE5404",
                "FAR1001",
            ]);
        });

        test("departamentos: by the code prefix, turmas or not", () => {
            const data = [...DATA, disc("MTM0000", "Sem turmas", [])];
            assert.deepStrictEqual(codesOf(filterDisciplinas(data, filtro({ departamento: ["MTM"] }))), [
                "MTM3100",
                "MTM0000",
            ]);
        });

        test("different keys narrow each other, and curso with professor must hold on the same turma", () => {
            assert.deepStrictEqual(
                codesOf(filterDisciplinas(DATA, filtro({ curso: ["208"], professor: ["Jean Martina"] }))),
                ["INE5417", "INE5404"],
            );
            // INE5417 has a 208 turma and an Ana Paula turma, but not one turma that is both
            assert.deepStrictEqual(filterDisciplinas(DATA, filtro({ curso: ["208"], professor: ["Ana Paula"] })), []);
            assert.deepStrictEqual(
                codesOf(filterDisciplinas(DATA, filtro({ departamento: ["INE"], professor: ["Ana Paula"] }))),
                ["INE5417"],
            );
        });

        test("no filter at all keeps everything", () => {
            assert.deepStrictEqual(filterDisciplinas(DATA, filtro({})), DATA);
        });
    });

    describe("sortDisciplinasByFase", () => {
        test("orders by the minimum fase among the cursos' turmas, then by code", () => {
            const sorted = sortDisciplinasByFase(filterDisciplinas(DATA, filtro({ curso: ["208"] })), ids("208"));
            assert.deepStrictEqual(codesOf(sorted), ["MTM3100", "INE5404", "INE5417", "INE5430", "INE5998", "INE5999"]);
        });

        test("reads the fase from the selected cursos' own turmas, not from another curso's", () => {
            const data = [
                disc("ABC1234", "Mista", [turma("01208", 208), turma("09238", 238)]),
                disc("ABC0001", "Outra", [turma("05238", 238)]),
            ];
            assert.deepStrictEqual(codesOf(sortDisciplinasByFase(data, ids("238"))), ["ABC0001", "ABC1234"]);
            assert.deepStrictEqual(codesOf(sortDisciplinasByFase(data, ids("208", "238"))), ["ABC1234", "ABC0001"]);
        });

        test("accepts a trailing letter after the five digits", () => {
            const data = [disc("B", "b", [turma("08208B", 208)]), disc("A", "a", [turma("07208A", 208)])];
            assert.deepStrictEqual(codesOf(sortDisciplinasByFase(data, ids("208"))), ["A", "B"]);
        });
    });

    describe("searchRows", () => {
        test("empty line: every disciplina, no suggestions", () => {
            const rows = rowsOf("");
            assert.strictEqual(rows.length, DATA.length);
            assert.ok(rows.every((row) => row.kind === "item"));
        });

        test("text matching a curso: suggestions first, then the disciplina results", () => {
            assert.deepStrictEqual(codes(rowsOf("farma")), ["curso:FARMÁCIA", "FAR1001"]);
        });

        test("text that is exactly a departamento code suggests it ahead of the code matches", () => {
            assert.deepStrictEqual(codes(rowsOf("ine")).slice(0, 2), ["departamento:INE", "INE5417"]);
            assert.ok(rowsOf("INE54").every((row) => row.kind === "item"));
        });

        test("text with two words matching a professor suggests them", () => {
            assert.deepStrictEqual(codes(rowsOf("jean mart")), ["professor:Jean Martina", "INE5417", "INE5404"]);
            assert.ok(rowsOf("jean").every((row) => row.kind === "item"));
        });

        test("editing chip: entries of its key matching the value, as token rows, whatever surrounds it", () => {
            assert.deepStrictEqual(codes(rowsOf("INE54 ", editingChip("curso", "info"), " x")), [
                "curso:SISTEMAS DE INFORMAÇÃO (noturno)",
            ]);
            assert.strictEqual(rowsOf(FAR, editingChip("curso", "")).length, catalogo.curso.length);
            assert.deepStrictEqual(codes(rowsOf(editingChip("professor", "ana"))), ["professor:Ana Paula"]);
            assert.deepStrictEqual(codes(rowsOf(editingChip("departamento", "m"))), ["departamento:MTM"]);
            assert.deepStrictEqual(rowsOf(editingChip("curso", "zzz")), []);
        });

        test("editing one key lists only what the other keys' chips leave reachable", () => {
            assert.deepStrictEqual(codes(rowsOf(CCO, editingChip("professor", ""))), ["professor:Jean Martina"]);
            assert.deepStrictEqual(codes(rowsOf(SI, editingChip("professor", ""))), ["professor:Ana Paula"]);
            assert.deepStrictEqual(codes(rowsOf(SI, CCO, editingChip("professor", ""))), [
                "professor:Ana Paula",
                "professor:Jean Martina",
            ]);
            assert.deepStrictEqual(codes(rowsOf(ANA, editingChip("curso", ""))), [
                "curso:SISTEMAS DE INFORMAÇÃO (noturno)",
            ]);
            assert.deepStrictEqual(codes(rowsOf(FAR, editingChip("departamento", ""))), ["departamento:FAR"]);
            assert.deepStrictEqual(codes(rowsOf(INE, editingChip("professor", "a"))), ["professor:Ana Paula"]);
        });

        test("a chip of the same key does not narrow its own list", () => {
            assert.strictEqual(rowsOf(CCO, editingChip("curso", "")).length, catalogo.curso.length);
            assert.deepStrictEqual(codes(rowsOf(JEAN, editingChip("professor", ""))), [
                "professor:Ana Paula",
                "professor:Jean Martina",
                "professor:Maria",
            ]);
        });

        test("suggestions from free text respect the same reach", () => {
            assert.deepStrictEqual(
                codes(rowsOf(CCO, "ana pau")).filter((c) => c.startsWith("professor")),
                [],
            );
            assert.deepStrictEqual(codes(rowsOf(SI, "ana pau"))[0], "professor:Ana Paula");
            assert.deepStrictEqual(
                codes(rowsOf(ANA, "far")).filter((c) => c.startsWith("curso")),
                [],
            );
        });

        test("editing without a catalogue (legacy data) lists nothing", () => {
            assert.deepStrictEqual(searchRows(segments(editingChip("curso", "")), DATA, EMPTY_CATALOGO), []);
        });

        test("one closed curso, no text: the curso's disciplinas in fase order", () => {
            assert.deepStrictEqual(codes(rowsOf(SI)), ["MTM3100", "INE5417"]);
            assert.deepStrictEqual(codes(rowsOf("  ", SI, "  ")), ["MTM3100", "INE5417"]);
        });

        test("two closed cursos, no text: the union of both, ordered by the lowest fase in either", () => {
            const data = [
                disc("ABC1234", "Mista", [turma("01208", 208), turma("09238", 238)]),
                disc("ABC0001", "Outra", [turma("05238", 238)]),
                disc("ABC0002", "Apenas CCO", [turma("03208", 208)]),
                disc("ABC0003", "Fora", [turma("01102", 102)]),
            ];
            assert.deepStrictEqual(codes(searchRows(segments(SI, CCO), data, catalogo)), [
                "ABC1234",
                "ABC0002",
                "ABC0001",
            ]);
            assert.deepStrictEqual(codes(searchRows(segments(SI), data, catalogo)), ["ABC0001", "ABC1234"]);
        });

        test("professor or departamento chips alone keep the data order", () => {
            assert.deepStrictEqual(codes(rowsOf(ANA)), ["INE5417", "MTM3100"]);
            assert.deepStrictEqual(codes(rowsOf(INE)), ["INE5417", "INE5404", "INE5430", "INE5999", "INE5998"]);
        });

        test("chips of different keys combine", () => {
            assert.deepStrictEqual(codes(rowsOf(CCO, JEAN)), ["INE5404", "INE5417"]);
            assert.deepStrictEqual(codes(rowsOf(INE, ANA, "software")), ["INE5417"]);
            assert.deepStrictEqual(rowsOf(CCO, ANA), []);
        });

        test("closed chips with text around them: the usual scoring over the concatenated text, restricted", () => {
            assert.deepStrictEqual(codes(rowsOf(CCO, "INE54")), ["INE5417", "INE5404", "INE5430"]);
            assert.deepStrictEqual(codes(rowsOf("engenharia", CCO, "software")), ["INE5417"]);
            assert.deepStrictEqual(rowsOf(CCO, "Maria"), []);
            assert.deepStrictEqual(codes(rowsOf(CCO, "Maria", FAR)), ["FAR1001"]);
        });

        test("suggestions still come from the free text beside chips, minus what is already chosen", () => {
            assert.deepStrictEqual(codes(rowsOf(FAR, "farma")), ["FAR1001"]);
            assert.deepStrictEqual(codes(rowsOf(FAR, "sist")), ["curso:SISTEMAS DE INFORMAÇÃO (noturno)"]);
            assert.ok(rowsOf(INE, "ine").every((row) => row.kind === "item"));
        });
    });
});
