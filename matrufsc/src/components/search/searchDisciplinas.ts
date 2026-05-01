import type { JSONDisciplina } from "~/context/campusData/types";

function normalize(s: string): string {
    return s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .trim();
}

export function searchDisciplinas(query: string, data: JSONDisciplina[]): JSONDisciplina[] {
    const q = normalize(query);
    if (!q) return data;

    const tokens = q.split(/\s+/).filter(Boolean);
    const scored: Array<{ item: JSONDisciplina; score: number }> = [];

    for (const disc of data) {
        const code = disc[0];
        const name = disc[1];

        let score = 0;

        if (code === q) score = 10000;
        else if (code.startsWith(q)) score = 5000;
        else if (code.includes(q)) score = 1000;

        if (tokens.every((t) => name.includes(t))) {
            const fullIdx = name.indexOf(q);
            if (fullIdx !== -1) {
                score += 500 + Math.max(0, 50 - fullIdx);
            } else {
                const firstIdx = name.indexOf(tokens[0]);
                score += 100 + Math.max(0, 50 - firstIdx);
            }
        }

        if (score === 0) {
            outer: for (const turma of disc[3]) {
                for (const prof of turma[8]) {
                    const pn = normalize(prof);
                    if (tokens.every((t) => pn.includes(t))) {
                        score = 50;
                        break outer;
                    }
                }
            }
        }

        if (score > 0) scored.push({ item: disc, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.item);
}
