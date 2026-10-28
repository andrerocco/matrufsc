import { describe, test } from "node:test";
import assert from "node:assert";
import { getTurmaFromJSON, getDisciplinaFromJSON } from "./parse";
import type { JSONDisciplina, JSONTurma } from "./schema";

const CURSOS = { "208": "ENGENHARIA MECÂNICA", "3": "QUÍMICA - Bacharelado [Campus Florianópolis]" };

const TURMA: JSONTurma = [
    "01652", // id
    36, // carga_horaria
    37, // vagas_ofertadas
    27, // vagas_ocupadas
    0, // alunos_especiais
    10, // saldo_vagas
    0, // pedidos_sem_vaga
    ["6.1830-2 / CTS-SL117A"], // rawAulas
    ["Cláudia Destro dos Santos"], // professores
    208, // curso
    null, // status
];

const PARSED_TURMA = {
    id: "01652",
    carga_horaria: 36,
    vagas_ofertadas: 37,
    vagas_ocupadas: 27,
    aulas: [
        {
            dia_semana: 6,
            horarios: [10, 11], // indices for 1830 and 1920
            sala: "CTS-SL117A",
        },
    ],
    professores: ["Cláudia Destro dos Santos"],
    curso: { id: 208, nome: "ENGENHARIA MECÂNICA" },
    status: null,
    selected: true,
};

function turma(overrides: Partial<Record<number, unknown>>): JSONTurma {
    const copy = [...TURMA] as unknown[];
    for (const [index, value] of Object.entries(overrides)) copy[Number(index)] = value;
    return copy as JSONTurma;
}

describe("getTurmaFromJSON", () => {
    test("resolves curso in cursos and keeps status raw", () => {
        assert.deepStrictEqual(getTurmaFromJSON(TURMA, CURSOS), PARSED_TURMA);
        assert.deepStrictEqual(getTurmaFromJSON(turma({ 9: 3, 10: "Reservada Curso" }), CURSOS), {
            ...PARSED_TURMA,
            curso: { id: 3, nome: "QUÍMICA - Bacharelado [Campus Florianópolis]" },
            status: "Reservada Curso",
        });
    });

    test("multiple aulas", () => {
        const result = getTurmaFromJSON(turma({ 7: ["3.1830-2 / CTS-LB108A", "4.2020-2 / CTS-LB108A"] }), CURSOS);

        assert.deepStrictEqual(result.aulas, [
            { dia_semana: 3, horarios: [10, 11], sala: "CTS-LB108A" },
            { dia_semana: 4, horarios: [12, 13], sala: "CTS-LB108A" },
        ]);
    });

    test("throws for a curso missing from cursos", () => {
        assert.throws(() => getTurmaFromJSON(turma({ 9: 999 }), CURSOS), { message: "Curso 999 is not in cursos." });
        assert.throws(() => getTurmaFromJSON(TURMA, {}), { message: "Curso 208 is not in cursos." });
    });

    test("throws when the tuple does not have 11 fields", () => {
        assert.throws(() => getTurmaFromJSON(TURMA.slice(0, 9) as unknown as JSONTurma, CURSOS), {
            message: "Turma 01652 has 9 fields, expected 11.",
        });
        assert.throws(() => getTurmaFromJSON(TURMA.slice(0, 10) as unknown as JSONTurma, CURSOS), {
            message: "Turma 01652 has 10 fields, expected 11.",
        });
    });

    test("keeps everything after the first separator as the sala", () => {
        assert.deepStrictEqual(getTurmaFromJSON(turma({ 7: ["2.2020-2 / CTS / SL1"] }), CURSOS).aulas, [
            { dia_semana: 2, horarios: [12, 13], sala: "CTS / SL1" },
        ]);
    });

    test("throws for an aula outside dia.HHMM-N / sala", () => {
        for (const raw of ["20730-2 / X", "2.0730-2", "2.0730-0 / X", "2.0730-x / X", "x.0730-2 / X", "2.730-2 / X"]) {
            assert.throws(() => getTurmaFromJSON(turma({ 7: [raw] }), CURSOS), {
                message: `Aula "${raw}" is not in the format dia.HHMM-N / sala.`,
            });
        }
    });

    test("throws for a dia outside DIAS_SEMANA", () => {
        assert.throws(() => getTurmaFromJSON(turma({ 7: ["8.0730-2 / X"] }), CURSOS), {
            message: 'Aula "8.0730-2 / X" is on dia 8, expected one of 1, 2, 3, 4, 5, 6, 7.',
        });
    });

    test("throws for a horário de início outside HORAS", () => {
        assert.throws(() => getTurmaFromJSON(turma({ 7: ["6.9999-2 / CTS-SL117A"] }), CURSOS), {
            message: 'Aula "6.9999-2 / CTS-SL117A" starts at 9999, which is not in HORAS.',
        });
    });

    test("throws when the aulas run past the last horário", () => {
        assert.throws(() => getTurmaFromJSON(turma({ 7: ["6.2110-2 / CTS-SL117A"] }), CURSOS), {
            message: 'Aula "6.2110-2 / CTS-SL117A" ends after the last horário in HORAS.',
        });
        assert.deepStrictEqual(
            getTurmaFromJSON(turma({ 7: ["6.2110-1 / CTS-SL117A"] }), CURSOS).aulas[0].horarios,
            [13],
        );
    });
});

describe("getDisciplinaFromJSON", () => {
    test("disciplina with one turma", () => {
        const jsonDisciplina: JSONDisciplina = [
            "CIT7146",
            "Introdução à Economia na Engenharia",
            [["06653", 36, 45, 16, 0, 29, 0, ["5.1420-2 / CTS-LB118A"], ["Simone Meister Sommer Bilessimo"], 3, null]],
        ];

        const result = getDisciplinaFromJSON(jsonDisciplina, "FLO", "20261", CURSOS);

        assert.deepStrictEqual(result, {
            id: "CIT7146",
            nome: "Introdução à Economia na Engenharia",
            semester: "20261",
            campus: "FLO",
            turmas: [
                {
                    id: "06653",
                    carga_horaria: 36,
                    vagas_ofertadas: 45,
                    vagas_ocupadas: 16,
                    aulas: [
                        {
                            dia_semana: 5,
                            horarios: [6, 7], // indices for 1420 and 1510
                            sala: "CTS-LB118A",
                        },
                    ],
                    professores: ["Simone Meister Sommer Bilessimo"],
                    curso: { id: 3, nome: "QUÍMICA - Bacharelado [Campus Florianópolis]" },
                    status: null,
                    selected: true,
                },
            ],
            selected: true,
        });
    });

    test("passes cursos to every turma", () => {
        const result = getDisciplinaFromJSON(
            ["EMB5001", "Nome", [TURMA, turma({ 0: "01653", 9: 3, 10: "Cancelada" })]],
            "JOI",
            "20271",
            CURSOS,
        );

        assert.deepStrictEqual(
            result.turmas.map((t) => [t.id, t.curso.id, t.status]),
            [
                ["01652", 208, null],
                ["01653", 3, "Cancelada"],
            ],
        );
        assert.throws(() => getDisciplinaFromJSON(["EMB5001", "Nome", [TURMA]], "JOI", "20271", { "3": "X" }), {
            message: "Curso 208 is not in cursos.",
        });
    });

    test("throws when the disciplina does not have 3 fields", () => {
        assert.throws(
            () =>
                getDisciplinaFromJSON(
                    ["CIT7146", "NOME", "Nome", [TURMA]] as unknown as JSONDisciplina,
                    "FLO",
                    "20261",
                    CURSOS,
                ),
            { message: "Disciplina CIT7146 has 4 fields, expected 3." },
        );
    });
});
