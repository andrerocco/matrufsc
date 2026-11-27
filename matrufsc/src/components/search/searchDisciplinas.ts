import type { JSONCampus, JSONDisciplina, JSONTurma } from "~/data/schema";
import { disciplinaNome } from "~/lib/nomeCompleto";
import { departamentoOf, searchEntries, suggestEntries, type Catalogo, type Entry } from "./catalogo";
import { normalize } from "./normalize";
import {
    TOKEN_KEYS,
    editingAt,
    queryText,
    selectedValues,
    type SearchRow,
    type Segment,
    type TokenKey,
} from "./searchLine";

interface SearchEntry {
    disciplina: JSONDisciplina;
    codigo: string;
    nome: string;
    // The name as the list prints it, curso included, since users type that too ("estagio eletrica").
    texto: string;
}

export function indexDisciplinas(campus?: Pick<JSONCampus, "cursos" | "disciplinas">): SearchEntry[] {
    if (!campus) return [];
    return campus.disciplinas.map((disciplina) => {
        const [codigo, nome] = disciplina;
        return {
            disciplina,
            codigo,
            nome: normalize(nome),
            texto: normalize(disciplinaNome(disciplina, campus.cursos)),
        };
    });
}

const ROMANOS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const OUTRA_FORMA = new Map<string, string>();
ROMANOS.forEach((r, i) => OUTRA_FORMA.set(r, `${i + 1}`).set(`${i + 1}`, r));

// A phrase found in the name scores more the earlier it starts, and most when it is the whole name.
function phraseScore(texto: string, nome: string, phrase: string): number {
    const at = texto.indexOf(phrase);
    return at === -1 ? 0 : 500 + Math.max(0, 50 - at) + (nome === phrase ? 100 : 0);
}

interface Match {
    disciplina: JSONDisciplina;
    score: number;
    // Matched by its code or its own name, not only by the status or curso shown after the name.
    direct: boolean;
}

function matchDisciplinas(query: string, index: SearchEntry[]): Match[] {
    const q = normalize(query);
    if (!q) return index.map(({ disciplina }) => ({ disciplina, score: 0, direct: true }));

    const code = q.replace(/^([A-Z]{3}) +(?=\d)/, "$1"); // "ine 5417"
    const tokens = q.split(/\s+/).filter(Boolean);
    // After the first word a numeral also matches its other form as a whole word: "fisica 2" finds Física II, and
    // "calculo ii" lists Cálculo 2 right below Cálculo II.
    const others = tokens.map((t, i) => (i > 0 ? OUTRA_FORMA.get(t) : undefined));
    const otherWords = others.map((o) => (o ? new RegExp(`\\b${o}\\b`) : undefined));
    const alt = tokens.map((t, i) => others[i] ?? t).join(" ");
    const fits = (s: string) => tokens.every((t, i) => s.includes(t) || otherWords[i]?.test(s));
    const matches: Match[] = [];

    for (const { disciplina, codigo, nome, texto } of index) {
        let score = 0;

        if (codigo === code) score = 10000;
        else if (codigo.startsWith(code)) score = 5000;
        else if (codigo.includes(code)) score = 1000;

        const direct = score > 0 || fits(nome);
        if (fits(texto)) {
            const phrase = Math.max(phraseScore(texto, nome, q), phraseScore(texto, nome, alt) - 1);
            score += phrase || 100 + Math.max(0, 50 - texto.indexOf(tokens[0]));
        }

        if (score > 0) matches.push({ disciplina, score, direct });
    }

    return matches.sort((a, b) => b.score - a.score);
}

export const searchDisciplinas = (query: string, index: SearchEntry[]): JSONDisciplina[] =>
    matchDisciplinas(query, index).map((match) => match.disciplina);

type Filtro = Record<TokenKey, ReadonlySet<string>>;

const filtroOf = (segments: Segment[]): Filtro => ({
    curso: new Set(selectedValues(segments, "curso").map((v) => v.id)),
    professor: new Set(selectedValues(segments, "professor").map((v) => v.id)),
    departamento: new Set(selectedValues(segments, "departamento").map((v) => v.id)),
});

const isActive = (filtro: Filtro) => TOKEN_KEYS.some((key) => filtro[key].size > 0);

// Chips of one key widen (any of these cursos), keys narrow each other, and curso and professor must hold on
// the same turma: "curso: X professor: P" means P's turma offered to X, not any turma of each.
const turmaMatches = (turma: JSONTurma, filtro: Filtro) =>
    (filtro.curso.size === 0 || filtro.curso.has(String(turma[9]))) &&
    (filtro.professor.size === 0 || turma[8].some((p) => filtro.professor.has(p)));

function filterDisciplinas(index: SearchEntry[], filtro: Filtro): SearchEntry[] {
    return index.filter(
        ({ disciplina: [codigo, , turmas] }) =>
            (filtro.departamento.size === 0 || filtro.departamento.has(departamentoOf(codigo))) &&
            turmas.some((turma) => turmaMatches(turma, filtro)),
    );
}

// Turma ids read "<fase><curso>" ("05208": 5th fase of curso 208), sometimes with a trailing letter. The
// fase is only a curriculum hint for ordering, so ids outside that shape just sort last.
const FASE_SHAPED_ID = /^\d{5}/;

function minFase([, , turmas]: JSONDisciplina, cursoIds: ReadonlySet<string>): number {
    let fase = Infinity;
    for (const turma of turmas) {
        if (!cursoIds.has(String(turma[9])) || !FASE_SHAPED_ID.test(turma[0])) continue;
        fase = Math.min(fase, Number(turma[0].slice(0, 2)));
    }
    return fase;
}

function sortByFase(index: SearchEntry[], cursoIds: ReadonlySet<string>): SearchEntry[] {
    return index
        .map((entry) => ({ entry, fase: minFase(entry.disciplina, cursoIds) }))
        .sort((a, b) => a.fase - b.fase || a.entry.codigo.localeCompare(b.entry.codigo))
        .map(({ entry }) => entry);
}

const itemRows = (data: JSONDisciplina[]): SearchRow<JSONDisciplina>[] => data.map((item) => ({ kind: "item", item }));
const tokenRows = (key: TokenKey, entries: Entry[]): SearchRow<JSONDisciplina>[] =>
    entries.map(({ id, nome }) => ({ kind: "token", key, value: { id, nome } }));

// While one key is being chosen, only the values the other keys' chips leave reachable are offered: the
// professores of the chosen cursos, the cursos a chosen professor teaches, the departamentos of either.
// Chips of the same key widen, so they never narrow their own list.
function candidates(key: TokenKey, catalogo: Catalogo, index: SearchEntry[], filtro: Filtro): Entry[] {
    const others: Filtro = { ...filtro, [key]: new Set<string>() };
    if (!isActive(others)) return catalogo[key];
    const present = new Set<string>();
    for (const { disciplina } of filterDisciplinas(index, others)) {
        const [codigo, , turmas] = disciplina;
        if (key === "departamento") {
            present.add(departamentoOf(codigo));
            continue;
        }
        for (const turma of turmas) {
            if (!turmaMatches(turma, others)) continue;
            if (key === "curso") present.add(String(turma[9]));
            else for (const p of turma[8]) present.add(p);
        }
    }
    return catalogo[key].filter((e) => present.has(e.id));
}

const MAX_SUGGESTIONS = 3;

// A curso is suggested from the start of its name; a departamento only when the text is exactly its code,
// since three letters also begin many disciplina codes; a professor from two words on, since one first name
// would match dozens, or from one when no disciplina matches, as free text never searches professores.
function suggestions(query: string, catalogo: Catalogo, index: SearchEntry[], filtro: Filtro, noItems: boolean) {
    const offer = (key: TokenKey, pick: (entries: Entry[]) => Entry[]) =>
        tokenRows(
            key,
            pick(candidates(key, catalogo, index, filtro)).filter((e) => !filtro[key].has(e.id)),
        );
    const code = normalize(query);
    return [
        ...offer("curso", (entries) => suggestEntries(query, entries)),
        ...offer("departamento", (entries) => entries.filter((e) => e.id === code)),
        ...(query.trim() && (noItems || query.trim().includes(" "))
            ? offer("professor", (entries) => searchEntries(query, entries))
            : []),
    ].slice(0, MAX_SUGGESTIONS);
}

export function searchRows(segments: Segment[], index: SearchEntry[], catalogo: Catalogo): SearchRow<JSONDisciplina>[] {
    const editing = editingAt(segments)?.segment;
    const filtro = filtroOf(segments);
    if (editing) {
        return tokenRows(editing.key, searchEntries(editing.value, candidates(editing.key, catalogo, index, filtro)));
    }

    const query = queryText(segments);
    const scoped = isActive(filtro) ? filterDisciplinas(index, filtro) : index;
    const ordered = filtro.curso.size > 0 ? sortByFase(scoped, filtro.curso) : scoped;
    const matches = matchDisciplinas(query, ordered);
    const items = itemRows(matches.map((match) => match.disciplina));
    // The best disciplina stays above the suggested filters, so Enter still adds it, unless only the curso after
    // its name matched: "ciencias da computacao" asks for the curso.
    const lead = matches[0]?.direct ? 1 : 0;
    // A key's name typed alone ("curso") offers that filter above everything.
    const key = TOKEN_KEYS.find((k) => normalize(query) === k.toUpperCase());
    return [
        ...(key ? [{ kind: "key" as const, key }] : []),
        ...items.slice(0, lead),
        ...suggestions(query, catalogo, index, filtro, items.length === 0),
        ...items.slice(lead),
    ];
}
