import { test } from "node:test";
import assert from "node:assert/strict";
import { hashCombinacao } from "./combinacao-hash";
import type { Plano } from "~/context/plano/Plano.store";
import type { Aula, Materia, Turma } from "~/data/types";

const aula = (dia_semana: number, horarios: number[], sala = "SALA"): Aula => ({ dia_semana, horarios, sala });

const entry = (materiaId: string, turmaId: string, aulas: Aula[]): Plano[number] => ({
    materia: { id: materiaId } as Materia,
    turma: { id: turmaId, aulas } as Turma,
});

const plano: Plano = [
    entry("INE5410", "04208A", [aula(2, [0, 1]), aula(4, [0, 1])]),
    entry("MTM3110", "01208", [aula(3, [5, 6, 7, 8])]),
];

test("the hash of a combinação is the one links already carry", () => {
    assert.equal(hashCombinacao(plano), "n1ADFS");
});

test("the hash follows each matéria's slots, not its turma, salas or how the aulas split", () => {
    const sameGrid: Plano = [
        entry("MTM3110", "01208B", [aula(3, [5, 6], "CTC101"), aula(3, [7, 8], "CTC102")]),
        entry("INE5410", "04208B", [aula(4, [0, 1]), aula(2, [0, 1])]),
    ];
    const otherDay: Plano = [plano[0], entry("MTM3110", "01208", [aula(5, [5, 6, 7, 8])])];

    assert.equal(hashCombinacao(sameGrid), hashCombinacao(plano));
    assert.notEqual(hashCombinacao(otherDay), hashCombinacao(plano));
});
