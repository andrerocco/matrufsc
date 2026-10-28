/// Roda o parser do site sobre um staging de dados; sai com 1 se algum arquivo não puder ser lido.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getDisciplinaFromJSON, getTurmaFromJSON } from "../src/data/parse";
import type { JSONCampus, JSONCursos, JSONDisciplina } from "../src/data/schema";

const CAMPUS_FILE = /^(\d{5})-([A-Z]{3})\.json$/;

function message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function failingTurmaId(disciplina: JSONDisciplina, cursos: JSONCursos): string | undefined {
    if (disciplina.length !== 3 || !Array.isArray(disciplina[2])) return undefined;
    for (const turma of disciplina[2]) {
        try {
            getTurmaFromJSON(turma, cursos);
        } catch {
            return String(turma[0]);
        }
    }
    return undefined;
}

function* campusFiles(dir: string): Generator<{ path: string; name: string; semester: string; campus: string }> {
    for (const year of readdirSync(dir).sort()) {
        if (!/^\d{4}$/.test(year)) continue;
        for (const name of readdirSync(join(dir, year)).sort()) {
            const match = CAMPUS_FILE.exec(name);
            if (match) yield { path: join(dir, year, name), name, semester: match[1], campus: match[2] };
        }
    }
}

const dir = process.argv[2];
if (!dir) {
    console.error("uso: gate.ts <diretorio de staging>");
    process.exit(2);
}

const errors: string[] = [];
let files = 0;
let disciplinas = 0;
let turmas = 0;

for (const file of campusFiles(dir)) {
    files++;
    let data: JSONCampus;
    try {
        data = JSON.parse(readFileSync(file.path, "utf8"));
    } catch (error) {
        errors.push(`${file.name}: ${message(error)}`);
        continue;
    }
    if (typeof data.cursos !== "object" || data.cursos === null) {
        errors.push(`${file.name}: cursos is not an object.`);
        continue;
    }
    if (!Array.isArray(data.disciplinas)) {
        errors.push(`${file.name}: disciplinas is not an array.`);
        continue;
    }
    for (const disciplina of data.disciplinas) {
        try {
            turmas += getDisciplinaFromJSON(disciplina, file.campus, file.semester, data.cursos).turmas.length;
            disciplinas++;
        } catch (error) {
            const turmaId = failingTurmaId(disciplina, data.cursos);
            errors.push(`${file.name} ${disciplina[0]}${turmaId ? ` ${turmaId}` : ""}: ${message(error)}`);
        }
    }
}

if (files === 0) {
    errors.push(`${dir}: nenhum arquivo <ano>/<semestre>-<campus>.json encontrado.`);
}

if (errors.length) {
    console.error(errors.join("\n"));
    console.error(`gate: ${errors.length} erro(s).`);
    process.exit(1);
}
console.log(`gate ok: ${files} arquivos, ${disciplinas} disciplinas, ${turmas} turmas.`);
