import { describe, test } from "node:test";
import assert from "node:assert";
import type { JSONDisciplina, JSONTurma } from "~/lib/campusDataQuery";
import type { Materia, Turma } from "~/context/plano/Plano.store";
import { disciplinaNome, materiaNome } from "~/lib/nomeComCurso";

const cursos = { "102": "FARMÁCIA", "601": "CIÊNCIA E TECNOLOGIA [Campus de Joinville]" };
const jsonTurma = (id: string, curso: number | null): JSONTurma => [id, 72, 40, 10, 0, 30, 0, [], [], curso];
const disciplina = (turmas: JSONTurma[]): JSONDisciplina => [
    "ACL5134",
    "ATENCAO A SAUDE IV",
    "Atenção à Saúde IV",
    turmas,
];

describe("nome com curso", () => {
    test("suffixes the disciplina with the first turma's curso, as the CAGR lists it", () => {
        const disc = disciplina([jsonTurma("08102A", 102), jsonTurma("08601", 601)]);
        assert.strictEqual(disciplinaNome(disc, cursos), "Atenção à Saúde IV *FARMÁCIA");
    });

    test("keeps the campus qualifier the CAGR puts on the curso", () => {
        assert.strictEqual(
            disciplinaNome(disciplina([jsonTurma("01601", 601)]), cursos),
            "Atenção à Saúde IV *CIÊNCIA E TECNOLOGIA [Campus de Joinville]",
        );
    });

    test("leaves the name alone for legacy data without curso or cursos map", () => {
        assert.strictEqual(disciplinaNome(disciplina([jsonTurma("08102A", null)]), cursos), "Atenção à Saúde IV");
        assert.strictEqual(disciplinaNome(disciplina([jsonTurma("08102A", 102)])), "Atenção à Saúde IV");
        assert.strictEqual(disciplinaNome(disciplina([]), cursos), "Atenção à Saúde IV");
    });

    test("reads the materia's suffix from its turmas", () => {
        const turma = (id: string, curso: Turma["curso"]): Turma => ({
            id,
            carga_horaria: 72,
            vagas_ofertadas: 40,
            vagas_ocupadas: 10,
            aulas: [],
            professores: [],
            curso,
            selected: true,
        });
        const materia = (turmas: Turma[]): Materia => ({
            id: "ACL5134",
            nome: "Atenção à Saúde IV",
            campus: "FLO",
            semester: "20262",
            turmas,
            selected: true,
        });
        assert.strictEqual(
            materiaNome(materia([turma("08102A", null), turma("08102B", { id: 102, nome: "FARMÁCIA" })])),
            "Atenção à Saúde IV *FARMÁCIA",
        );
        assert.strictEqual(materiaNome(materia([turma("08102A", null)])), "Atenção à Saúde IV");
    });
});
