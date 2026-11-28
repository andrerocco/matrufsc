import { test } from "node:test";
import assert from "node:assert/strict";
import { usePlano } from "./Plano.store";
import { serializeMaterias } from "../url/url-parser";
import type { Materia, Turma } from "~/data/types";

const turma = (id: string, dia: number): Turma => ({
    id,
    carga_horaria: 36,
    vagas_ofertadas: 20,
    vagas_ocupadas: 0,
    pedidos_sem_vaga: 0,
    aulas: [{ dia_semana: dia, horarios: [0], sala: "SALA" }],
    professores: [],
    curso: { id: 1, nome: "CURSO" },
    status: null,
    selected: true,
});

const materia = (id: string, dia: number): Materia => ({
    id,
    nome: id,
    campus: "FLO",
    semester: "20271",
    turmas: [turma("A", dia), turma("B", dia + 1)],
    selected: true,
});

test("undoing a removal puts the materia back in place with its color and selections", () => {
    const { materias, addMateria, removeMateria, updateTurmasSelected } = usePlano();
    addMateria(materia("AAA0001", 2));
    addMateria(materia("BBB0002", 3));
    addMateria(materia("CCC0003", 4));
    updateTurmasSelected("BBB0002", ["A"], false);
    const before = JSON.stringify(materias);
    const url = serializeMaterias(materias);

    const restore = removeMateria("BBB0002");
    assert.deepEqual(
        materias.map((m) => m.id),
        ["AAA0001", "CCC0003"],
    );
    restore();

    assert.equal(JSON.stringify(materias), before);
    assert.equal(serializeMaterias(materias), url);
});
