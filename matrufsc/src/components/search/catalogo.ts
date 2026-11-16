import type { JSONCampus } from "~/data/schema";
import { normalizeWords } from "./normalize";
import type { TokenKey } from "./searchLine";

export interface Entry {
    id: string;
    nome: string;
    words: string[];
}

export type Catalogo = Record<TokenKey, Entry[]>;

export const EMPTY_CATALOGO: Catalogo = { curso: [], professor: [], departamento: [] };

// Every disciplina code is three letters, which name the departamento, followed by digits.
export const departamentoOf = (codigo: string) => codigo.slice(0, 3);

const entry = (id: string, nome: string): Entry => ({ id, nome, words: normalizeWords(nome) });
const byNome = (a: Entry, b: Entry) => a.nome.localeCompare(b.nome, "pt-BR");

export function buildCatalogo(campus?: Pick<JSONCampus, "cursos" | "disciplinas">): Catalogo {
    if (!campus) return EMPTY_CATALOGO;
    const professores = new Set<string>();
    const departamentos = new Set<string>();
    for (const [codigo, , turmas] of campus.disciplinas) {
        departamentos.add(departamentoOf(codigo));
        for (const turma of turmas) for (const nome of turma[8]) professores.add(nome);
    }
    return {
        curso: Object.entries(campus.cursos)
            .map(([id, nome]) => entry(id, nome))
            .sort(byNome),
        professor: [...professores].map((nome) => entry(nome, nome)).sort(byNome),
        departamento: [...departamentos].sort().map((code) => entry(code, code)),
    };
}

export function searchEntries(query: string, entries: Entry[]): Entry[] {
    const words = normalizeWords(query);
    if (words.length === 0) return entries;
    return entries.filter((e) => words.every((w) => e.words.some((ew) => ew.startsWith(w))));
}

const SUGGESTION_MIN_CHARS = 3;

export function suggestEntries(query: string, entries: Entry[]): Entry[] {
    const words = normalizeWords(query);
    if (words.join("").length < SUGGESTION_MIN_CHARS) return [];
    return entries.filter((e) => words.length <= e.words.length && words.every((w, i) => e.words[i].startsWith(w)));
}
