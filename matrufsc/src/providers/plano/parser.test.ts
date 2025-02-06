import { describe, test } from "node:test";
import assert from "node:assert";
import { getTurmaFromJSON, getDisciplinaFromJSON, type JSONTurma, type JSONDisciplina } from "./parser";

describe("JSON Transformers", () => {
    describe("getTurmaFromJSON", () => {
        test("should correctly transform a simple turma", () => {
            const jsonTurma: JSONTurma = [
                "01652", // id
                36, // carga_horaria
                37, // vagas_ofertadas
                27, // vagas_ocupadas
                0, // vagas_reservadas
                10, // vagas_disponiveis
                0, // vagas_excedentes
                ["6.1830-2 / CTS-SL117A"], // rawAulas
                ["Cláudia Destro dos Santos"], // professores
            ];

            const result = getTurmaFromJSON(jsonTurma);

            assert.deepStrictEqual(result, {
                id: "01652",
                carga_horaria: 36,
                aulas: [
                    {
                        dia_semana: 6,
                        horarios: [10, 11], // indices for 1830 and 1920
                        sala: "CTS-SL117A",
                    },
                ],
                professores: ["Cláudia Destro dos Santos"],
                selected: true,
            });
        });

        test("should correctly transform a turma with multiple aulas", () => {
            const jsonTurma: JSONTurma = [
                "02652",
                72,
                35,
                33,
                0,
                2,
                0,
                ["3.1830-2 / CTS-LB108A", "4.2020-2 / CTS-LB108A"],
                ["Cristian Cechinel"],
            ];

            const result = getTurmaFromJSON(jsonTurma);

            assert.deepStrictEqual(result, {
                id: "02652",
                carga_horaria: 72,
                aulas: [
                    {
                        dia_semana: 3,
                        horarios: [10, 11], // indices for 1830 and 1920
                        sala: "CTS-LB108A",
                    },
                    {
                        dia_semana: 4,
                        horarios: [12, 13], // indices for 2020 and 2110
                        sala: "CTS-LB108A",
                    },
                ],
                professores: ["Cristian Cechinel"],
                selected: true,
            });
        });

        test("should throw error for invalid horario_inicio", () => {
            const jsonTurma: JSONTurma = [
                "01652",
                36,
                37,
                27,
                0,
                10,
                0,
                ["6.9999-2 / CTS-SL117A"], // invalid time
                ["Cláudia Destro dos Santos"],
            ];

            assert.throws(() => getTurmaFromJSON(jsonTurma), {
                message: "Invalid horarioInicio: 9999.",
            });
        });

        test("should throw error when horario_inicio + creditos exceeds HORAS length", () => {
            const jsonTurma: JSONTurma = [
                "01652",
                36,
                37,
                27,
                0,
                10,
                0,
                ["6.2110-2 / CTS-SL117A"], // last time slot + 2 credits
                ["Cláudia Destro dos Santos"],
            ];

            assert.throws(() => getTurmaFromJSON(jsonTurma), {
                message: "Sum of horarioInicio and creditos is out of bounds: 2110, 2.",
            });
        });
    });

    describe("getDisciplinaFromJSON", () => {
        test("should correctly transform a disciplina with one turma", () => {
            const jsonDisciplina: JSONDisciplina = [
                "CIT7146",
                "INTRODUCAO A ECONOMIA NA ENGENHARIA",
                "Introdução à Economia na Engenharia",
                [["06653", 36, 45, 16, 0, 29, 0, ["5.1420-2 / CTS-LB118A"], ["Simone Meister Sommer Bilessimo"]]],
            ];

            const result = getDisciplinaFromJSON(jsonDisciplina);

            assert.deepStrictEqual(result, {
                id: "CIT7146",
                nome: "Introdução à Economia na Engenharia",
                turmas: [
                    {
                        id: "06653",
                        carga_horaria: 36,
                        aulas: [
                            {
                                dia_semana: 5,
                                horarios: [6, 7], // indices for 1420 and 1510
                                sala: "CTS-LB118A",
                            },
                        ],
                        professores: ["Simone Meister Sommer Bilessimo"],
                        selected: true,
                    },
                ],
                selected: true,
                cor: "black",
            });
        });

        test("should correctly transform a disciplina with multiple turmas", () => {
            const jsonDisciplina: JSONDisciplina = [
                "CIT7122",
                "ELABORACAO DE TRABALHOS ACADEMICOS",
                "Elaboração de Trabalhos Acadêmicos",
                [
                    ["01652", 36, 37, 27, 0, 10, 0, ["6.1830-2 / CTS-SL117A"], ["Cláudia Destro dos Santos"]],
                    ["01653", 36, 30, 12, 0, 18, 0, ["6.1830-2 / CTS-SL117A"], ["Cláudia Destro dos Santos"]],
                ],
            ];

            const result = getDisciplinaFromJSON(jsonDisciplina);

            assert.strictEqual(result.turmas.length, 2);
            assert.strictEqual(result.id, "CIT7122");
            assert.strictEqual(result.nome, "Elaboração de Trabalhos Acadêmicos");
            assert.strictEqual(result.selected, true);
            assert.strictEqual(result.cor, "black");

            // Check first turma
            assert.deepStrictEqual(result.turmas[0].aulas[0], {
                dia_semana: 6,
                horarios: [10, 11],
                sala: "CTS-SL117A",
            });
        });
    });
});
