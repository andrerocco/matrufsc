import { describe, test } from "node:test";
import assert from "node:assert";
import type { JSONDisciplina, JSONTurma } from "~/lib/campusDataQuery";
import { EMPTY_CATALOGO, buildCatalogo, searchEntries, suggestEntries } from "~/components/search/catalogo";

const FLO = {
    "102": "FARMÁCIA",
    "201": "ENGENHARIA CIVIL",
    "212": "ENGENHARIA DE PRODUÇÃO CIVIL",
    "310": "CIÊNCIAS SOCIAIS",
    "320": "CIÊNCIAS SOCIAIS (noturno)",
    "404": "EDUCAÇÃO FÍSICA - Licenciatura",
    "444": "EDUCAÇÃO FÍSICA - Bacharelado",
    "236": "ENGENHARIA DE MATERIAIS [Semestral]",
};

const JOI = {
    "607": "ENGENHARIA CIVIL DE INFRAESTRUTURA [Campus Joinville]",
    "601": "CIÊNCIA E TECNOLOGIA [Campus de Joinville]",
};

const turma = (id: string, professores: string[]): JSONTurma => [id, 72, 40, 10, 0, 30, 0, [], professores, null];
const disc = (code: string, turmas: JSONTurma[]): JSONDisciplina => [code, code, code, turmas];
const campus = (cursos: Record<string, string> | undefined, disciplinas: JSONDisciplina[] = []) => ({
    cursos,
    disciplinas,
});

const nomes = (list: { nome: string }[]) => list.map((c) => c.nome);
const cursos = (map: Record<string, string>) => buildCatalogo(campus(map)).curso;

describe("catalogo", () => {
    describe("buildCatalogo", () => {
        test("is empty without campus data", () => {
            assert.deepStrictEqual(buildCatalogo(undefined), EMPTY_CATALOGO);
        });

        test("has no cursos for legacy data without a cursos map", () => {
            assert.deepStrictEqual(buildCatalogo(campus(undefined, [disc("INE5417", [turma("05208", ["Ana"])])])), {
                curso: [],
                professor: [{ id: "Ana", nome: "Ana", words: ["ANA"] }],
                departamento: [{ id: "INE", nome: "INE", words: ["INE"] }],
            });
        });

        test("strips the campus suffix from cursos but keeps other bracketed qualifiers", () => {
            assert.deepStrictEqual(nomes(cursos(JOI)), ["CIÊNCIA E TECNOLOGIA", "ENGENHARIA CIVIL DE INFRAESTRUTURA"]);
            assert.ok(nomes(cursos(FLO)).includes("ENGENHARIA DE MATERIAIS [Semestral]"));
        });

        test("keeps curso variants as separate entries with their own ids, sorted by name", () => {
            const catalogo = cursos(FLO);
            assert.deepStrictEqual(
                catalogo.filter((c) => c.nome.startsWith("EDUCAÇÃO FÍSICA")).map((c) => [c.id, c.nome]),
                [
                    ["444", "EDUCAÇÃO FÍSICA - Bacharelado"],
                    ["404", "EDUCAÇÃO FÍSICA - Licenciatura"],
                ],
            );
            assert.deepStrictEqual(
                catalogo.filter((c) => c.nome.startsWith("CIÊNCIAS SOCIAIS")).map((c) => c.id),
                ["310", "320"],
            );
        });

        test("indexes normalized words of the display name", () => {
            const [sociais] = cursos({ "320": "CIÊNCIAS SOCIAIS (noturno)" });
            assert.deepStrictEqual(sociais.words, ["CIENCIAS", "SOCIAIS", "NOTURNO"]);
        });

        test("collects every professor once, by name, sorted", () => {
            const { professor } = buildCatalogo(
                campus({}, [
                    disc("INE5417", [turma("05208", ["Zé Maria", "Ana Paula"]), turma("05238", ["Ana Paula"])]),
                    disc("MTM3100", [turma("01208", ["Élio"])]),
                ]),
            );
            assert.deepStrictEqual(nomes(professor), ["Ana Paula", "Élio", "Zé Maria"]);
            assert.deepStrictEqual(professor[0], { id: "Ana Paula", nome: "Ana Paula", words: ["ANA", "PAULA"] });
        });

        test("collects departamentos from the first three letters of the codes, sorted", () => {
            const { departamento } = buildCatalogo(
                campus({}, [disc("MTM3100", []), disc("INE5417", []), disc("INE5404", [])]),
            );
            assert.deepStrictEqual(nomes(departamento), ["INE", "MTM"]);
        });
    });

    describe("searchEntries", () => {
        const catalogo = cursos(FLO);

        test("lists everything for an empty value", () => {
            assert.strictEqual(searchEntries("", catalogo).length, catalogo.length);
            assert.strictEqual(searchEntries("   ", catalogo).length, catalogo.length);
        });

        test("matches accent- and case-insensitively on word prefixes", () => {
            assert.deepStrictEqual(nomes(searchEntries("farmacia", catalogo)), ["FARMÁCIA"]);
            assert.deepStrictEqual(nomes(searchEntries("ciencias sociais", catalogo)), [
                "CIÊNCIAS SOCIAIS",
                "CIÊNCIAS SOCIAIS (noturno)",
            ]);
            assert.deepStrictEqual(nomes(searchEntries("noturno", catalogo)), ["CIÊNCIAS SOCIAIS (noturno)"]);
        });

        test("each word may match any word of the name", () => {
            assert.deepStrictEqual(nomes(searchEntries("civil", catalogo)), [
                "ENGENHARIA CIVIL",
                "ENGENHARIA DE PRODUÇÃO CIVIL",
            ]);
            assert.deepStrictEqual(nomes(searchEntries("fisica bach", catalogo)), ["EDUCAÇÃO FÍSICA - Bacharelado"]);
        });

        test("is empty when nothing matches", () => {
            assert.deepStrictEqual(searchEntries("odontologia", catalogo), []);
        });
    });

    describe("suggestEntries", () => {
        const catalogo = cursos(FLO);

        test("suggests on a whole-word prefix of the display name", () => {
            assert.deepStrictEqual(nomes(suggestEntries("farmacia", catalogo)), ["FARMÁCIA"]);
            assert.deepStrictEqual(nomes(suggestEntries("Farmá", catalogo)), ["FARMÁCIA"]);
            assert.deepStrictEqual(nomes(suggestEntries("eng civil", catalogo)), ["ENGENHARIA CIVIL"]);
            assert.deepStrictEqual(nomes(suggestEntries("ciencias sociais", catalogo)), [
                "CIÊNCIAS SOCIAIS",
                "CIÊNCIAS SOCIAIS (noturno)",
            ]);
        });

        test("does not suggest from the middle of the name", () => {
            assert.deepStrictEqual(suggestEntries("civil", catalogo), []);
            assert.deepStrictEqual(suggestEntries("sociais", catalogo), []);
        });

        test("needs at least three characters", () => {
            assert.deepStrictEqual(suggestEntries("en", catalogo), []);
            assert.deepStrictEqual(suggestEntries("e n", catalogo), []);
            assert.ok(suggestEntries("eng", catalogo).length > 0);
        });

        test("caps the number of suggestions", () => {
            assert.strictEqual(suggestEntries("eng", catalogo).length, 3);
            assert.strictEqual(suggestEntries("eng", catalogo, 2).length, 2);
        });

        test("never suggests from an empty catalogue", () => {
            assert.deepStrictEqual(suggestEntries("farmacia", []), []);
        });
    });
});
