import type { JSONDisciplina } from "~/data/schema";

function normalize(s: string): string {
    return s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .trim();
}

export interface SearchEntry {
    disciplina: JSONDisciplina;
    codigo: string;
    nome: string;
    professores: string[];
}

/// Normalizes once per campus load what the search compares against on every keystroke.
export function indexDisciplinas(disciplinas: JSONDisciplina[]): SearchEntry[] {
    return disciplinas.map((disciplina) => {
        const [codigo, nome, turmas] = disciplina;
        return {
            disciplina,
            codigo,
            nome: normalize(nome),
            professores: turmas.flatMap((turma) => turma[8].map(normalize)),
        };
    });
}

export function searchDisciplinas(query: string, index: SearchEntry[]): JSONDisciplina[] {
    const q = normalize(query);
    if (!q) return index.map((entry) => entry.disciplina);

    const tokens = q.split(/\s+/).filter(Boolean);
    const scored: Array<{ item: JSONDisciplina; score: number }> = [];

    for (const { disciplina, codigo, nome, professores } of index) {
        let score = 0;

        if (codigo === q) score = 10000;
        else if (codigo.startsWith(q)) score = 5000;
        else if (codigo.includes(q)) score = 1000;

        if (tokens.every((t) => nome.includes(t))) {
            const fullIdx = nome.indexOf(q);
            if (fullIdx !== -1) {
                score += 500 + Math.max(0, 50 - fullIdx);
            } else {
                const firstIdx = nome.indexOf(tokens[0]);
                score += 100 + Math.max(0, 50 - firstIdx);
            }
        }

        if (score === 0 && professores.some((prof) => tokens.every((t) => prof.includes(t)))) {
            score = 50;
        }

        if (score > 0) scored.push({ item: disciplina, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.item);
}
