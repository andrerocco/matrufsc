import { HORAS } from "~/data/schema";
import type { Plano } from "~/context/plano/Plano.store";
import type { Turma } from "~/data/types";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const LENGTH = 6;
const PATTERN = new RegExp(`^[${ALPHABET}]{${LENGTH}}$`);

export const isCombinacaoHash = (value: string) => PATTERN.test(value);

// The combinação as the grid shows it: the slots each matéria takes. Turma ids, salas and how the slots split
// into aulas stay out. Links already saved carry a hash of this text, so changing it makes them all stop matching.
function gradeKey(plano: Plano): string {
    return plano.map(entryKey).sort().join("|");
}

// Opening a link hashes every combinação, and the large planos have hundreds of thousands of them.
const entryKeys = new WeakMap<Turma, string>();

function entryKey({ materia, turma }: Plano[number]): string {
    let key = entryKeys.get(turma);
    if (key === undefined) {
        const slots = turma.aulas.flatMap((aula) =>
            aula.horarios.map((horario) => `${aula.dia_semana}.${HORAS[horario]}`),
        );
        key = `${materia.id}:${[...new Set(slots)].sort().join(",")}`;
        entryKeys.set(turma, key);
    }
    return key;
}

// cyrb53, by bryc (public domain)
function cyrb53(text: string): number {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        h1 = Math.imul(h1 ^ code, 2654435761);
        h2 = Math.imul(h2 ^ code, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

function hashKey(key: string): string {
    let value = cyrb53(key) % ALPHABET.length ** LENGTH;
    let hash = "";
    for (let i = 0; i < LENGTH; i++) {
        hash = ALPHABET[value % ALPHABET.length] + hash;
        value = Math.floor(value / ALPHABET.length);
    }
    return hash;
}

export const hashCombinacao = (plano: Plano) => hashKey(gradeKey(plano));

/**
 * The combinação a link's hash stands for, or -1. `unique` is false when none has the hash, and when two that
 * look different share it.
 */
export function findCombinacao(planos: Plano[], hash: string): { index: number; unique: boolean } {
    const keys = planos.map(gradeKey);
    const matches = new Set(keys.filter((key) => hashKey(key) === hash));
    return { index: keys.findIndex((key) => matches.has(key)), unique: matches.size === 1 };
}
