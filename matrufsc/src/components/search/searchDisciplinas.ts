import type { JSONDisciplina, JSONTurma } from "~/lib/campusDataQuery";
import { normalize } from "./normalize";
import { searchEntries, suggestEntries, type Catalogo, type Entry } from "./catalogo";
import {
    TOKEN_KEYS,
    editingAt,
    queryText,
    selectedValues,
    type Segment,
    type SearchRow,
    type TokenKey,
} from "./searchLine";

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

export type Filtro = Record<TokenKey, ReadonlySet<string>>;

export const filtroOf = (segments: Segment[]): Filtro => ({
    curso: new Set(selectedValues(segments, "curso").map((v) => v.id)),
    professor: new Set(selectedValues(segments, "professor").map((v) => v.id)),
    departamento: new Set(selectedValues(segments, "departamento").map((v) => v.id)),
});

const isActive = (filtro: Filtro) => TOKEN_KEYS.some((key) => filtro[key].size > 0);

// Chips of one key widen (any of these cursos), keys narrow each other, and curso and professor must hold on
// the same turma: "curso: X professor: P" means P's turma offered to X, not any turma of each.
const turmaMatches = (turma: JSONTurma, filtro: Filtro) =>
    (filtro.curso.size === 0 || (turma[9] !== null && filtro.curso.has(String(turma[9])))) &&
    (filtro.professor.size === 0 || turma[8].some((p) => filtro.professor.has(p)));

export function filterDisciplinas(data: JSONDisciplina[], filtro: Filtro): JSONDisciplina[] {
    const byTurma = filtro.curso.size > 0 || filtro.professor.size > 0;
    return data.filter(
        (disc) =>
            (filtro.departamento.size === 0 || filtro.departamento.has(disc[0].slice(0, 3))) &&
            (!byTurma || disc[3].some((turma) => turmaMatches(turma, filtro))),
    );
}

// Turma ids read "<fase><curso>" ("05208": 5th fase of curso 208), sometimes with a trailing letter. The
// fase is only a curriculum hint for ordering, so ids outside that shape just sort last.
const FASE_SHAPED_ID = /^\d{5}/;

function minFase(disc: JSONDisciplina, cursoIds: ReadonlySet<string>): number {
    let fase = Infinity;
    for (const turma of disc[3]) {
        if (turma[9] === null || !cursoIds.has(String(turma[9])) || !FASE_SHAPED_ID.test(turma[0])) continue;
        fase = Math.min(fase, Number(turma[0].slice(0, 2)));
    }
    return fase;
}

export function sortDisciplinasByFase(data: JSONDisciplina[], cursoIds: ReadonlySet<string>): JSONDisciplina[] {
    return data
        .map((disc) => ({ disc, fase: minFase(disc, cursoIds) }))
        .sort((a, b) => a.fase - b.fase || a.disc[0].localeCompare(b.disc[0]))
        .map(({ disc }) => disc);
}

const itemRows = (data: JSONDisciplina[]): SearchRow<JSONDisciplina>[] => data.map((item) => ({ kind: "item", item }));
const tokenRows = (key: TokenKey, entries: Entry[]): SearchRow<JSONDisciplina>[] =>
    entries.map(({ id, nome }) => ({ kind: "token", key, value: { id, nome } }));

// While one key is being chosen, only the values the other keys' chips leave reachable are offered: the
// professores of the chosen cursos, the cursos a chosen professor teaches, the departamentos of either.
// Chips of the same key widen, so they never narrow their own list.
export function candidates(key: TokenKey, catalogo: Catalogo, data: JSONDisciplina[], filtro: Filtro): Entry[] {
    const others: Filtro = { ...filtro, [key]: new Set<string>() };
    if (!isActive(others)) return catalogo[key];
    const present = new Set<string>();
    for (const disc of filterDisciplinas(data, others)) {
        if (key === "departamento") {
            present.add(disc[0].slice(0, 3));
            continue;
        }
        for (const turma of disc[3]) {
            if (!turmaMatches(turma, others)) continue;
            if (key === "curso" && turma[9] !== null) present.add(String(turma[9]));
            if (key === "professor") for (const p of turma[8]) present.add(p);
        }
    }
    return catalogo[key].filter((e) => present.has(e.id));
}

const MAX_SUGGESTIONS = 3;

// A curso is suggested from the start of its name; a departamento only when the text is exactly its code,
// since three letters also begin many disciplina codes; a professor only from two words on, since one
// first name would match dozens.
export function suggestions(
    query: string,
    catalogo: Catalogo,
    data: JSONDisciplina[],
    filtro: Filtro,
): SearchRow<JSONDisciplina>[] {
    const offer = (key: TokenKey, pick: (entries: Entry[]) => Entry[]) =>
        tokenRows(
            key,
            pick(candidates(key, catalogo, data, filtro)).filter((e) => !filtro[key].has(e.id)),
        );
    const code = normalize(query);
    const rows = [
        ...offer("curso", (entries) => suggestEntries(query, entries)),
        ...offer("departamento", (entries) => entries.filter((e) => e.id === code)),
        ...(query.trim().includes(" ") ? offer("professor", (entries) => searchEntries(query, entries)) : []),
    ];
    return rows.slice(0, MAX_SUGGESTIONS);
}

export function searchRows(
    segments: Segment[],
    data: JSONDisciplina[],
    catalogo: Catalogo,
): SearchRow<JSONDisciplina>[] {
    const editing = editingAt(segments)?.segment;
    const filtro = filtroOf(segments);
    if (editing) {
        return tokenRows(editing.key, searchEntries(editing.value, candidates(editing.key, catalogo, data, filtro)));
    }

    const query = queryText(segments);
    const suggested = suggestions(query, catalogo, data, filtro);
    if (!isActive(filtro)) return [...suggested, ...itemRows(searchDisciplinas(query, data))];

    const scoped = filterDisciplinas(data, filtro);
    const ordered = query
        ? searchDisciplinas(query, scoped)
        : filtro.curso.size > 0
          ? sortDisciplinasByFase(scoped, filtro.curso)
          : scoped;
    return [...suggested, ...itemRows(ordered)];
}
