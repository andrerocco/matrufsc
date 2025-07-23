import { describe, it } from "node:test";
import assert from "node:assert";

import { Aula, combinacoes, findClosestCombination, Turma, type Materia, type Plano } from "./combinacoes";

// Test data mocks
const materiaA: Materia = {
    id: "INE0001",
    nome: "Fundamentos de Programação",
    turmas: [
        {
            id: "T1",
            carga_horaria: 60,
            aulas: [
                { dia_semana: 2, horarios: [0, 1], sala: "CTC001" },
                { dia_semana: 4, horarios: [0, 1], sala: "CTC001" },
            ],
            professores: [],
            selected: true,
        },
    ],
    selected: true,
};

const materiaB: Materia = {
    id: "INE0002",
    nome: "Fundamentos da Matemática",
    turmas: [
        {
            id: "T1",
            carga_horaria: 60,
            aulas: [
                { dia_semana: 2, horarios: [2, 3], sala: "CTC002" },
                { dia_semana: 4, horarios: [5, 6], sala: "CTC002" },
            ],
            professores: [],
            selected: true,
        },
        {
            id: "T2",
            carga_horaria: 60,
            aulas: [
                { dia_semana: 3, horarios: [4, 5], sala: "CTC003" },
                { dia_semana: 5, horarios: [6, 7], sala: "CTC003" },
            ],
            professores: [],
            selected: true,
        },
    ],
    selected: true,
};

const materiaC: Materia = {
    id: "INE0003",
    nome: "Cálculo A",
    turmas: [
        {
            id: "T1",
            carga_horaria: 60,
            aulas: [
                { dia_semana: 2, horarios: [1, 2], sala: "CTC004" }, // Conflicts with materiaA
                { dia_semana: 4, horarios: [5, 6], sala: "CTC004" },
            ],
            professores: [],
            selected: true,
        },
    ],
    selected: true,
};

function aulas(from: Partial<Aula>[]): Aula[] {
    return from.map((aula) => ({
        dia_semana: 1,
        horarios: [0],
        sala: "SALA001",
        ...aula,
    }));
}

function turma(from: Partial<Turma>): Turma {
    return {
        id: `T${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        carga_horaria: Math.floor(Math.random() * 100) + 60,
        aulas: [],
        professores: [],
        selected: true,
        ...from,
    };
}

function materia(from: Partial<Materia>): Materia {
    return {
        id: `MAT${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        nome: `Materia ${Math.random().toString(36).substring(2, 8)}`,
        turmas: [],
        selected: true,
        ...from,
    };
}

describe("combinacoes", () => {
    describe("retorno vazio", () => {
        it("deve retornar uma array vazia para um input vazio", () => {
            const result = combinacoes([]);

            assert.strictEqual(result.length, 0);
            assert.deepStrictEqual(result, []);
        });

        it("deve retornar uma array vazia para 1 matéria não selecionada", () => {
            const materiaNaoSelecionada = materia({
                id: "MAT001",
                turmas: [turma({ aulas: aulas([{ dia_semana: 2, horarios: [0, 1] }]) })],
                selected: false,
            });

            const result = combinacoes([materiaNaoSelecionada]);

            assert.strictEqual(result.length, 0);
            assert.deepStrictEqual(result, []);
        });

        it("deve retornar uma array vazia para múltiplas matérias não selecionadas", () => {
            const materia1 = materia({
                id: "MAT001",
                turmas: [turma({ aulas: aulas([{ dia_semana: 2, horarios: [0, 1] }]) })],
                selected: false,
            });
            const materia2 = materia({
                id: "MAT002",
                turmas: [turma({ aulas: aulas([{ dia_semana: 3, horarios: [0, 1] }]) })],
                selected: false,
            });

            const result = combinacoes([materia1, materia2]);

            assert.strictEqual(result.length, 0);
            assert.deepStrictEqual(result, []);
        });
    });

    describe("gerar único plano", () => {
        it("deve retornar 1 plano com 2 matérias quando as matérias não possuem conflitos", () => {
            const materia1 = materia({
                id: "MAT001",
                turmas: [turma({ aulas: aulas([{ dia_semana: 2, horarios: [0, 1] }]) })],
            });
            const materia2 = materia({
                id: "MAT002",
                turmas: [turma({ aulas: aulas([{ dia_semana: 2, horarios: [2, 3] }]) })],
            });

            const result = combinacoes([materia1, materia2]);

            assert.strictEqual(result.length, 1); // 1 Plano
            assert.strictEqual(result[0].length, 2); // 2 Materias
            assert.strictEqual(result[0][0].materia.id, materia1.id);
            assert.strictEqual(result[0][1].materia.id, materia2.id);
            assert.strictEqual(materia1.blocked, false);
            assert.strictEqual(materia2.blocked, false);
        });

        it("deve retornar 1 plano com 2 matérias quando as matérias com aulas nos mesmos horários em dias diferentes", () => {
            const materia1 = materia({
                id: "MAT001",
                turmas: [turma({ aulas: aulas([{ dia_semana: 2, horarios: [0, 1] }]) })],
            });
            const materia2 = materia({
                id: "MAT002",
                turmas: [turma({ aulas: aulas([{ dia_semana: 3, horarios: [0, 1] }]) })],
            });

            const result = combinacoes([materia1, materia2]);

            assert.strictEqual(result.length, 1); // 1 Plano
            assert.strictEqual(result[0].length, 2); // 2 Materias
            assert.strictEqual(result[0][0].materia.id, materia1.id);
            assert.strictEqual(result[0][1].materia.id, materia2.id);
            assert.strictEqual(materia1.blocked, false);
            assert.strictEqual(materia2.blocked, false);
        });

        it("deve retornar 1 plano contendo apenas a primeira matéria quando as matérias possuem conflitos", () => {
            const materia1 = materia({
                id: "MAT001",
                turmas: [turma({ aulas: aulas([{ dia_semana: 2, horarios: [0, 1] }]) })],
            });
            const materia2 = materia({
                id: "MAT002",
                turmas: [turma({ aulas: aulas([{ dia_semana: 2, horarios: [1, 2] }]) })],
            });

            const result = combinacoes([materia1, materia2]);

            assert.strictEqual(result.length, 1); // 1 Plano
            assert.strictEqual(result[0].length, 1); // 1 Materia
            assert.strictEqual(result[0][0].materia.id, materia1.id); // apenas a primeira matéria
            assert.strictEqual(materia1.blocked, false);
            assert.strictEqual(materia2.blocked, true); // materia2 deve ser marcada como bloqueada
        });

        it("deve retornar 1 plano com 2 matérias quando uma matéria tem turmas com aulas vazias", () => {
            const materia1 = materia({
                id: "MAT001",
                turmas: [turma({ aulas: aulas([{ dia_semana: 2, horarios: [0, 1] }]) })],
            });
            const materia2 = materia({
                id: "MAT002",
                turmas: [turma({ aulas: [] })], // turma com aulas vazias
            });

            const result = combinacoes([materia1, materia2]);

            assert.strictEqual(result.length, 1); // 1 Plano
            assert.strictEqual(result[0].length, 2); // 2 Materias
            assert.strictEqual(result[0][0].materia.id, materia1.id);
            assert.strictEqual(result[0][1].materia.id, materia2.id);
            assert.strictEqual(materia1.blocked, false);
            assert.strictEqual(materia2.blocked, false);
        });

        it("deve retornar 1 plano com 1 matéria quando uma das matérias tem turmas vazias, sem bloquear a matéria sem turmas", () => {
            const materia1 = materia({
                id: "MAT001",
                turmas: [turma({ aulas: aulas([{ dia_semana: 2, horarios: [0, 1] }]) })],
            });
            const materia2 = materia({
                id: "MAT002",
                turmas: [], // turma vazia
            });

            const result = combinacoes([materia1, materia2]);

            assert.strictEqual(result.length, 1); // 1 Plano
            assert.strictEqual(result[0].length, 1); // 2 Materias
            assert.strictEqual(result[0][0].materia.id, materia1.id);
            assert.strictEqual(materia1.blocked, false);
            assert.strictEqual(materia2.blocked, false);
        });
    });

    describe("gerar múltiplos planos", () => {
        it("deve retornar 4 planos para 2 matérias com 2 turmas cada", () => {
            const materia1 = materia({
                id: "MAT001",
                turmas: [
                    turma({ id: "T1", aulas: aulas([{ dia_semana: 2, horarios: [0, 1] }]) }),
                    turma({ id: "T2", aulas: aulas([{ dia_semana: 2, horarios: [2, 3] }]) }),
                ],
            });
            const materia2 = materia({
                id: "MAT002",
                turmas: [
                    turma({ id: "T3", aulas: aulas([{ dia_semana: 3, horarios: [0, 1] }]) }),
                    turma({ id: "T4", aulas: aulas([{ dia_semana: 3, horarios: [2, 3] }]) }),
                ],
            });

            const result = combinacoes([materia1, materia2]);

            assert.strictEqual(result.length, 4); // 4 Planos
            assert.strictEqual(result[0].length, 2); // 2 Materias

            result.forEach((plano) => {
                assert.strictEqual(plano[0].materia.id, materia1.id);
                assert.strictEqual(plano[1].materia.id, materia2.id);
            });

            assert.strictEqual(result[0][0].turma.id, "T1");
            assert.strictEqual(result[0][1].turma.id, "T3");

            assert.strictEqual(result[1][0].turma.id, "T1");
            assert.strictEqual(result[1][1].turma.id, "T4");

            assert.strictEqual(result[2][0].turma.id, "T2");
            assert.strictEqual(result[2][1].turma.id, "T3");

            assert.strictEqual(result[3][0].turma.id, "T2");
            assert.strictEqual(result[3][1].turma.id, "T4");

            assert.strictEqual(materia1.blocked, false);
            assert.strictEqual(materia2.blocked, false);
        });

        it("deve retornar 2 planos com 1 matéria cada caso as matérias possuam mesmo id e turmas distintas", () => {
            // TODO: Contrasta com o caso "deve mesclar materias distintas mas que contenham o mesmo ID e turmas equivalentes"
            const materia1 = materia({
                id: "MAT001",
                turmas: [turma({ id: "T1", aulas: aulas([{ dia_semana: 2, horarios: [0, 1] }]) })],
            });
            const materia2 = materia({
                id: "MAT001",
                turmas: [turma({ id: "T2", aulas: aulas([{ dia_semana: 3, horarios: [0, 1] }]) })],
            });

            const result = combinacoes([materia1, materia2]);

            console.log("1.", result);
            console.log("2.", result[0]);
            console.log("3.", result[1]);

            assert.strictEqual(result.length, 2); // 2 Planos
            assert.strictEqual(result[0].length, 1); // 1 Materia
            assert.strictEqual(result[1].length, 1); // 1 Materia

            assert.strictEqual(result[0][0].materia.id, materia1.id);
            assert.strictEqual(result[0][0].turma.id, "T1");

            assert.strictEqual(result[1][0].materia.id, materia2.id);
            assert.strictEqual(result[1][0].turma.id, "T2");

            assert.strictEqual(materia1.blocked, false);
            assert.strictEqual(materia2.blocked, false);
        });

        it("deve retornar 2 planos com 1 matéria cada quando uma matéria possui aulas e a outra não", () => {
            const materia1 = materia({
                id: "MAT001",
                turmas: [turma({ aulas: aulas([{ dia_semana: 2, horarios: [0, 1] }]) })],
            });
            const materia2 = materia({
                id: "MAT002",
                turmas: [turma({ aulas: [] })], // turma com aulas vazias
            });

            const result = combinacoes([materia1, materia2]);

            assert.strictEqual(result.length, 2); // 2 Planos
            assert.strictEqual(result[0].length, 1); // 1 Materia
            assert.strictEqual(result[1].length, 1); // 1 Materia

            assert.strictEqual(result[0][0].materia.id, materia1.id);
            assert.strictEqual(result[0][0].turma.aulas.length, 1);

            assert.strictEqual(result[1][0].materia.id, materia2.id);
            assert.strictEqual(result[1][0].turma.aulas.length, 0);

            assert.strictEqual(materia1.blocked, false);
            assert.strictEqual(materia2.blocked, false);
        });

        it("deve retornar 2 planos com 1 matéria cada quando uma matéria não possui aulas e a outra não possui turmas", () => {
            const materia1 = materia({
                id: "MAT001",
                turmas: [turma({ aulas: [] })], // turma com aulas vazias
            });
            const materia2 = materia({ id: "MAT002", turmas: [] }); // Matéria sem turmas

            const result = combinacoes([materia1, materia2]);

            assert.strictEqual(result.length, 2); // 2 Planos
            assert.strictEqual(result[0].length, 1); // 1 Materia
            assert.strictEqual(result[1].length, 1); // 1 Materia

            assert.strictEqual(result[0][0].materia.id, materia1.id);
            assert.strictEqual(result[0][0].turma.aulas.length, 0);

            assert.strictEqual(result[1][0].materia.id, materia2.id);
            assert.strictEqual(result[1][0].turma.aulas.length, 0);

            assert.strictEqual(materia1.blocked, false);
            assert.strictEqual(materia2.blocked, false);
        });
    });

    describe("mesclar turmas equivalentes", () => {
        it("deve retornar 1 plano com 1 turma quando a matéria possuir 2 turmas equivalentes", () => {
            const representingTurma = turma({ id: "T1", aulas: aulas([{ dia_semana: 6, horarios: [0] }]) });
            const materia1 = materia({
                id: "MAT001",
                turmas: [representingTurma, turma({ id: "T2", aulas: aulas([{ dia_semana: 6, horarios: [0] }]) })],
            });

            const result = combinacoes([materia1]);

            assert.strictEqual(result.length, 1); // 1 Plano
            assert.strictEqual(result[0].length, 1); // 1 Materia
            assert.strictEqual(result[0][0].materia.id, materia1.id);
            assert.strictEqual(result[0][0].turma.id, representingTurma.id);
            assert.deepStrictEqual(result[0][0].turma, representingTurma);
            assert.strictEqual(materia1.blocked, false);
        });

        it("deve retornar 1 plano com 1 turma quando a matéria possuir múltiplas turmas equivalentes", () => {
            const materia1 = materia({
                id: "MAT001",
                turmas: [
                    turma({ id: "T1", aulas: aulas([{ dia_semana: 4, horarios: [4, 5, 10] }]) }),
                    turma({ id: "T2", aulas: aulas([{ dia_semana: 4, horarios: [4, 5, 10] }]) }),
                    turma({ id: "T3", aulas: aulas([{ dia_semana: 4, horarios: [4, 5, 10] }]) }),
                    turma({ id: "T3", aulas: aulas([{ dia_semana: 4, horarios: [4, 5, 10] }]) }),
                ],
            });

            const result = combinacoes([materia1]);

            assert.strictEqual(result.length, 1); // 1 Plano
            assert.strictEqual(result[0].length, 1); // 1 Materia
            assert.strictEqual(result[0][0].materia.id, materia1.id);
            assert.strictEqual(result[0][0].turma.id, "T1");
            assert.strictEqual(materia1.blocked, false);
        });

        it("deve retornar 1 plano com 2 matérias quando uma matéria possui turmas equivalentes", () => {
            const materia1 = materia({
                id: "MAT001",
                turmas: [
                    turma({ id: "T1", aulas: aulas([{ dia_semana: 2, horarios: [0, 1] }]) }),
                    turma({ id: "T2", aulas: aulas([{ dia_semana: 2, horarios: [0, 1] }]) }),
                ],
            });
            const materia2 = materia({
                id: "MAT002",
                turmas: [turma({ aulas: aulas([{ dia_semana: 3, horarios: [0, 1] }]) })],
            });

            const result = combinacoes([materia1, materia2]);

            assert.strictEqual(result.length, 1); // 1 Plano
            assert.strictEqual(result[0].length, 2); // 2 Materias
            assert.strictEqual(result[0][0].materia.id, materia1.id);
            assert.strictEqual(result[0][1].materia.id, materia2.id);
            assert.strictEqual(materia1.blocked, false);
            assert.strictEqual(materia2.blocked, false);
        });

        it("deve retornar 1 plano com 2 matérias quando ambas possuem turmas equivalentes", () => {
            const materia1 = materia({
                id: "MAT001",
                turmas: [
                    turma({ id: "M1T1", aulas: aulas([{ dia_semana: 2, horarios: [0, 1] }]) }),
                    turma({ id: "M1T2", aulas: aulas([{ dia_semana: 2, horarios: [0, 1] }]) }),
                ],
            });
            const materia2 = materia({
                id: "MAT002",
                turmas: [
                    turma({ id: "M2T1", aulas: aulas([{ dia_semana: 2, horarios: [2, 3] }]) }),
                    turma({ id: "M2T2", aulas: aulas([{ dia_semana: 2, horarios: [2, 3] }]) }),
                ],
            });

            const result = combinacoes([materia1, materia2]);

            assert.strictEqual(result.length, 1); // 1 Plano
            assert.strictEqual(result[0].length, 2); // 2 Materias
            assert.strictEqual(result[0][0].materia.id, materia1.id);
            assert.strictEqual(result[0][1].materia.id, materia2.id);
            assert.strictEqual(result[0][0].turma.id, "M1T1");
            assert.strictEqual(result[0][1].turma.id, "M2T1");
            assert.strictEqual(materia1.blocked, false);
            assert.strictEqual(materia2.blocked, false);
        });

        it("deve retornar 1 plano com 1 matéria quando ambas possuem turmas equivalentes, mas com horários conflitantes", () => {
            const materia1 = materia({
                id: "MAT001",
                turmas: [
                    turma({ id: "M1T1", aulas: aulas([{ dia_semana: 2, horarios: [0, 1, 2] }]) }),
                    turma({ id: "M1T2", aulas: aulas([{ dia_semana: 2, horarios: [0, 1, 2] }]) }),
                ],
            });
            const materia2 = materia({
                id: "MAT002",
                turmas: [
                    turma({ id: "M2T1", aulas: aulas([{ dia_semana: 2, horarios: [1] }]) }),
                    turma({ id: "M2T2", aulas: aulas([{ dia_semana: 2, horarios: [1] }]) }),
                ],
            });

            const result = combinacoes([materia1, materia2]);

            assert.strictEqual(result.length, 1); // 1 Plano
            assert.strictEqual(result[0].length, 1); // 2 Materias
            assert.strictEqual(result[0][0].materia.id, materia1.id);
            assert.strictEqual(result[0][0].turma.id, "M1T1");
            assert.strictEqual(materia1.blocked, false);
            assert.strictEqual(materia2.blocked, true);
        });

        it("deve retornar 2 planos com 2 máterias quando uma possui turmas equivalentes e a outra não", () => {
            const materia1 = materia({
                id: "MAT001",
                turmas: [
                    turma({ id: "M1T1", aulas: aulas([{ dia_semana: 2, horarios: [0, 1] }]) }),
                    turma({ id: "M1T2", aulas: aulas([{ dia_semana: 2, horarios: [0, 1] }]) }),
                ],
            });
            const materia2 = materia({
                id: "MAT002",
                turmas: [
                    turma({ id: "M2T1", aulas: aulas([{ dia_semana: 3, horarios: [0, 1] }]) }),
                    turma({ id: "M2T2", aulas: aulas([{ dia_semana: 4, horarios: [0, 1] }]) }),
                ],
            });

            const result = combinacoes([materia1, materia2]);

            assert.strictEqual(result.length, 2); // 2 Planos
            assert.strictEqual(result[0].length, 2); // 2 Materias
            assert.strictEqual(result[0][0].materia.id, materia1.id);
            assert.strictEqual(result[0][0].turma.id, "M1T1");
            assert.strictEqual(result[0][1].materia.id, materia2.id);
            assert.strictEqual(result[0][1].turma.id, "M2T1");

            assert.strictEqual(result[1].length, 2); // 2 Materias
            assert.strictEqual(result[1][0].materia.id, materia1.id);
            assert.strictEqual(result[1][0].turma.id, "M1T1"); // mantém a primeira matéria (já que são equivalentes)
            assert.strictEqual(result[1][1].materia.id, materia2.id);
            assert.strictEqual(result[1][1].turma.id, "M2T2");

            assert.strictEqual(materia1.blocked, false);
            assert.strictEqual(materia2.blocked, false);
        });

        it("deve mesclar turmas sem aulas", () => {
            const materia1 = materia({
                id: "MAT001",
                turmas: [turma({ id: "M1T1", aulas: [] }), turma({ id: "M1T2", aulas: [] })],
            });
            const materia2 = materia({
                id: "MAT002",
                turmas: [turma({ id: "M2T1", aulas: [] }), turma({ id: "M2T2", aulas: [] })],
            });

            const result = combinacoes([materia1, materia2]);

            assert.strictEqual(result.length, 1); // 1 Plano
            assert.strictEqual(result[0].length, 2); // 2 Matérias
            assert.strictEqual(result[0][0].materia.id, materia1.id);
            assert.strictEqual(result[0][0].turma.id, "M1T1");
            assert.strictEqual(result[0][1].materia.id, materia2.id);
            assert.strictEqual(result[0][1].turma.id, "M2T1");
            assert.strictEqual(materia1.blocked, false);
            assert.strictEqual(materia2.blocked, false);
        });

        it("deve mesclar materias distintas mas que contenham o mesmo ID e turmas equivalentes", () => {
            // TODO: Conferir se esse comportamento é desejado
            const materia1 = materia({
                id: "MAT001",
                turmas: [turma({ id: "T1", aulas: aulas([{ dia_semana: 2, horarios: [0, 1] }]) })],
            });
            const materia2 = materia({
                id: "MAT001",
                turmas: [turma({ id: "T1", aulas: aulas([{ dia_semana: 2, horarios: [0, 1] }]) })],
            });

            const result = combinacoes([materia1, materia2]);

            assert.strictEqual(result.length, 1); // 1 Plano
            assert.strictEqual(result[0].length, 1); // 1 Materia
            assert.strictEqual(result[0][0].materia.id, materia1.id);
            assert.strictEqual(result[0][0].turma.id, "T1");
            assert.strictEqual(materia1.blocked, false);
        });
    });

    describe("casos de conflito em que não deve haver bloqueio", () => {
        it("não deve bloquear matéria sem turmas", () => {
            const materia1 = materia({
                id: "MAT001",
                turmas: [],
            });

            const result = combinacoes([materia1]);

            assert.strictEqual(result.length, 0);
            assert.strictEqual(result, []);
            assert.strictEqual(materia1.blocked, false);
        });

        it("não deve bloquear matérias sem turmas", () => {
            const materia1 = materia({
                id: "MAT001",
                turmas: [],
            });
            const materia2 = materia({
                id: "MAT002",
                turmas: [],
            });

            const result = combinacoes([materia1, materia2]);

            assert.strictEqual(result.length, 1); // 1 Plano
            assert.strictEqual(result[0].length, 2); // 2 Materias
            assert.strictEqual(result[0][0].materia.id, materia1.id);
            assert.strictEqual(result[0][1].materia.id, materia2.id);
            assert.strictEqual(materia1.blocked, false);
            assert.strictEqual(materia2.blocked, false);
        });

        it("não deve bloquear matéria com turma sem aulas", () => {
            const materia1 = materia({
                id: "MAT001",
                turmas: [turma({ aulas: [] })],
            });

            const result = combinacoes([materia1]);

            assert.strictEqual(result.length, 0);
            assert.strictEqual(result, []);
            assert.strictEqual(materia1.blocked, false);
        });

        it("não deve bloquear matérias com turma sem aulas", () => {
            const materia1 = materia({
                id: "MAT001",
                turmas: [turma({ aulas: [] })],
            });
            const materia2 = materia({
                id: "MAT002",
                turmas: [turma({ aulas: [] })],
            });

            const result = combinacoes([materia1, materia2]);

            assert.strictEqual(result.length, 1); // 1 Plano
            assert.strictEqual(result[0].length, 2); // 2 Materias
            assert.strictEqual(result[0][0].materia.id, materia1.id);
            assert.strictEqual(result[0][1].materia.id, materia2.id);
            assert.strictEqual(materia1.blocked, false);
            assert.strictEqual(materia2.blocked, false);
        });

        it("não deve bloquear matéria com turma não selecionada", () => {
            const materia1 = materia({
                id: "MAT001",
                turmas: [turma({ aulas: aulas([{ dia_semana: 2, horarios: [0, 1] }]), selected: false })],
            });

            const result = combinacoes([materia1]);

            assert.strictEqual(result.length, 0); // nenhum plano deve ser retornado
            assert.strictEqual(materia1.blocked, false);
        });

        it("não deve bloquear matéria com turmas não selecionadas", () => {
            const materia1 = materia({
                id: "MAT001",
                turmas: [
                    turma({ aulas: aulas([{ dia_semana: 2, horarios: [0, 1] }]), selected: false }),
                    turma({ aulas: aulas([{ dia_semana: 3, horarios: [3, 4] }]), selected: false }),
                ],
            });

            const result = combinacoes([materia1]);

            assert.strictEqual(result.length, 0); // nenhum plano deve ser retornado
            assert.strictEqual(materia1.blocked, false);
        });

        it("não deve bloquear matéria não selecionada", () => {
            const materia1 = materia({
                id: "MAT001",
                turmas: [turma({ aulas: aulas([{ dia_semana: 2, horarios: [0, 1] }]) })],
                selected: false,
            });

            const result = combinacoes([materia1]);

            assert.strictEqual(result.length, 0); // nenhum plano deve ser retornado
            assert.strictEqual(materia1.blocked, false);
        });

        it("não deve bloquear matérias não selecionadas", () => {
            const materia1 = materia({
                id: "MAT001",
                turmas: [turma({ aulas: aulas([{ dia_semana: 2, horarios: [0, 1] }]) })],
                selected: false,
            });
            const materia2 = materia({
                id: "MAT002",
                turmas: [turma({ aulas: aulas([{ dia_semana: 3, horarios: [0, 1] }]) })],
                selected: false,
            });

            const result = combinacoes([materia1, materia2]);

            assert.strictEqual(result.length, 0); // nenhum plano deve ser retornado
            assert.strictEqual(materia1.blocked, false);
            assert.strictEqual(materia2.blocked, false);
        });

        it("não deve bloquear matérias conflitantes se uma delas não estiver selecionada", () => {
            const materia1 = materia({
                id: "MAT001",
                turmas: [turma({ aulas: aulas([{ dia_semana: 2, horarios: [0, 1] }]) })],
            });
            const materia2 = materia({
                id: "MAT002",
                turmas: [turma({ aulas: aulas([{ dia_semana: 2, horarios: [0, 1] }]) })],
                selected: false,
            });

            const result = combinacoes([materia1, materia2]);

            assert.strictEqual(result.length, 1); // 1 Plano
            assert.strictEqual(result[0].length, 1); // 1 Materia
            assert.strictEqual(result[0][0].materia.id, materia1.id);
            assert.strictEqual(materia1.blocked, false);
            assert.strictEqual(materia2.blocked, false); // não deve ser bloqueada
        });

        it("não deve bloquear matérias conflitantes se a turma conflitante não estiver selecionada", () => {
            const materia1 = materia({
                id: "MAT001",
                turmas: [turma({ aulas: aulas([{ dia_semana: 2, horarios: [0, 1] }]) })],
            });
            const materia2 = materia({
                id: "MAT002",
                turmas: [turma({ aulas: aulas([{ dia_semana: 2, horarios: [0, 1] }]), selected: false })],
            });

            const result = combinacoes([materia1, materia2]);

            assert.strictEqual(result.length, 1); // nenhum plano deve ser retornado
            assert.strictEqual(result[0].length, 1); // 1 Materia
            assert.strictEqual(result[0][0].materia.id, materia1.id);
            assert.strictEqual(materia1.blocked, false);
            assert.strictEqual(materia2.blocked, false);
        });

        it("não deve bloquear matérias se ambas as turmas conflitantes não tiverem selecionadas", () => {
            const materia1 = materia({
                id: "MAT001",
                turmas: [turma({ aulas: aulas([{ dia_semana: 2, horarios: [0, 1] }]), selected: false })],
            });
            const materia2 = materia({
                id: "MAT002",
                turmas: [turma({ aulas: aulas([{ dia_semana: 2, horarios: [0, 1] }]), selected: false })],
            });

            const result = combinacoes([materia1, materia2]);

            assert.strictEqual(result.length, 0); // nenhum plano deve ser retornado
            assert.strictEqual(materia1.blocked, false);
            assert.strictEqual(materia2.blocked, false);
        });

        it("matérias sem aulas ou sem turmas não devem ser marcadas como bloqueadas", () => {
            // TODO: Melhorar
            // This test specifically addresses the bug described in the issue
            // where materias with no turmas or only turmas with no aulas were incorrectly marked as blocked

            const normalMateria: Materia = {
                id: "NORMAL001",
                nome: "Normal Subject",
                turmas: [
                    {
                        id: "T1",
                        carga_horaria: 60,
                        aulas: [{ dia_semana: 2, horarios: [0, 1], sala: "ROOM001" }],
                        professores: ["Prof A"],
                        selected: true,
                    },
                ],
                selected: true,
            };

            const cancelledMateria: Materia = {
                id: "CANCELLED001",
                nome: "Cancelled Subject",
                turmas: [
                    {
                        id: "T1",
                        carga_horaria: 60,
                        aulas: [], // No aulas - represents a cancelled class
                        professores: ["Prof B"],
                        selected: true,
                    },
                ],
                selected: true,
            };

            const noTurmasMateria: Materia = {
                id: "EMPTY001",
                nome: "Subject with No Turmas",
                turmas: [], // No turmas at all
                selected: true,
            };

            const materias = [normalMateria, cancelledMateria, noTurmasMateria];
            const result = combinacoes(materias);

            // Should generate combinations including normal and cancelled materias
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].length, 2);

            // Verify the combination includes the right materias
            const includedIds = result[0].map((item) => item.materia.id);
            assert(includedIds.includes("NORMAL001"));
            assert(includedIds.includes("CANCELLED001"));

            // CRITICAL: None of these materias should be marked as blocked
            // Before the fix, cancelledMateria and noTurmasMateria would be incorrectly blocked
            assert.strictEqual(normalMateria.blocked, false);
            assert.strictEqual(cancelledMateria.blocked, false);
            assert.strictEqual(noTurmasMateria.blocked, false);
        });
    });

    describe("desbloquear matérias", () => {
        it("deve desbloquear matéria", () => {
            const materia1 = materia({
                id: "MAT001",
                turmas: [turma({ aulas: aulas([{ dia_semana: 2, horarios: [0, 1] }]) })],
                blocked: true, // previamente bloqueada
            });

            const result = combinacoes([materia1]);

            assert.strictEqual(result.length, 1); // 1 Plano
            assert.strictEqual(result[0].length, 1); // 1 Materia
            assert.strictEqual(result[0][0].materia.id, materia1.id);
            assert.strictEqual(materia1.blocked, false);
        });

        it("deve desbloquear matéria não selecionada", () => {
            const materia1 = materia({
                id: "MAT001",
                turmas: [turma({ aulas: aulas([{ dia_semana: 2, horarios: [0, 1] }]) })],
                selected: false, // não selecionada
                blocked: true, // previamente bloqueada
            });

            const result = combinacoes([materia1]);

            assert.strictEqual(result.length, 0); // nenhum plano deve ser retornado
            assert.strictEqual(materia1.blocked, false); // matéria deve ser desbloqueada
        });

        it("deve desbloquear matéria com maior prioridade e manter matéria de menor prioridade bloqueada caso sejam conflitantantes", () => {
            const materia1 = materia({
                id: "MAT001",
                turmas: [turma({ aulas: aulas([{ dia_semana: 2, horarios: [0, 1] }]) })],
                blocked: true, // previamente bloqueada
            });
            const materia2 = materia({
                id: "MAT002",
                turmas: [turma({ aulas: aulas([{ dia_semana: 2, horarios: [1, 2] }]) })],
                blocked: true, // previamente bloqueada
            });

            const result = combinacoes([materia1, materia2]);

            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].length, 1);
            assert.strictEqual(result[0][0].materia.id, materia1.id);
            assert.strictEqual(materia1.blocked, false);
            assert.strictEqual(materia2.blocked, true);
        });

        it("deve desbloquear matéria com turma sem aulas", () => {
            const materia1 = materia({
                id: "MAT001",
                turmas: [turma({ aulas: [] })], // turma sem aulas
                blocked: true, // previamente bloqueada
            });

            const result = combinacoes([materia1]);

            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].length, 1);
            assert.strictEqual(result[0][0].materia.id, materia1.id);
            assert.strictEqual(materia1.blocked, false);
        });
    });
});

describe("findClosestCombination function", () => {
    it("should find exact match", () => {
        const current: Plano = [
            { materia: materiaA, turma: materiaA.turmas[0] },
            { materia: materiaB, turma: materiaB.turmas[0] },
        ];

        const all: Plano[] = [
            [{ materia: materiaC, turma: materiaC.turmas[0] }],
            [...current],
            [{ materia: materiaB, turma: materiaB.turmas[1] }],
        ];

        const result = findClosestCombination(current, all);
        assert.strictEqual(result, 1); // Index of the exact match
    });

    it("should find partial match", () => {
        const current: Plano = [
            { materia: materiaA, turma: materiaA.turmas[0] },
            { materia: materiaB, turma: materiaB.turmas[0] },
        ];

        const all: Plano[] = [
            [{ materia: materiaC, turma: materiaC.turmas[0] }],
            [{ materia: materiaA, turma: materiaA.turmas[0] }], // Partial match
            [{ materia: materiaB, turma: materiaB.turmas[1] }], // Different turma
        ];

        const result = findClosestCombination(current, all);
        assert.strictEqual(result, 1); // Index of the partial match
    });

    it("should handle null current combination", () => {
        const all: Plano[] = [[{ materia: materiaA, turma: materiaA.turmas[0] }]];

        const result = findClosestCombination(null, all);
        assert.strictEqual(result, 0);
    });

    it("should handle empty combinations array", () => {
        const current: Plano = [{ materia: materiaA, turma: materiaA.turmas[0] }];

        const result = findClosestCombination(current, []);
        assert.strictEqual(result, 0);
    });
});

// TODO: Add test cases for blocking and *unblocking* materias. Interesting test case: INE5428, INE5420, EGR7710 (24.2)
// TODO: Tests that make sure that materias with no turmas or aulas are not set as blocked
