import { createCachedQuery } from "~/lib/createCachedResource";
import { makeCacheStorage } from "~/lib/makeCacheStorage";

// Response types

export type JSONTurma = [
    string, // Código da turma
    number, // Carga horária
    number, // Vagas ofertadas
    number, // Vagas ocupadas
    number, // Vagas reservadas
    number, // Vagas disponíveis
    number, // Vagas excedentes
    string[], // Locais e horários
    string[], // Professores
];

export type JSONDisciplina = [
    string, // Código
    string, // Nome completo
    string, // Nome
    JSONTurma[], // Turmas
];

export type JSONCampusCode = "FLO" | "JOI" | "CBS" | "ARA" | "BLN";
const CAMPUS_CODES: JSONCampusCode[] = ["FLO", "JOI", "CBS", "ARA", "BLN"];
export const isCampusCode = (value: string): value is JSONCampusCode => CAMPUS_CODES.includes(value as JSONCampusCode);

export interface JSONCampus {
    campus: JSONCampusCode;
    data_extracao: string;
    disciplinas: JSONDisciplina[];
}

// Query

async function fetchCampusData(source: { semester: string; campus: JSONCampusCode }): Promise<JSONCampus> {
    const { semester, campus } = source;
    const ano = semester.slice(0, 4);

    try {
        const resp = await fetch(`${import.meta.env.BASE_URL}data/${ano}/${semester}-${campus}.json`);
        if (!resp.ok) throw new Error(`Failed to load campus data: ${resp.status} ${resp.statusText}`);
        return await resp.json();
    } catch (error) {
        console.error("Error fetching campus data:", error);
        throw error;
    }
}

export const campusDataQuery = createCachedQuery(fetchCampusData, {
    key: (source) => `matrufsc:campusData:${source.campus}_${source.semester}`,
    storage: makeCacheStorage({ cacheName: "matrufsc:campusData" }),
});

// TODO: Temporary, remove after 09/2026
function cleanupLegacyCampusDataLocalStorage(): void {
    if (typeof localStorage === "undefined") return;
    try {
        for (let index = localStorage.length - 1; index >= 0; index--) {
            const key = localStorage.key(index);
            if (!key?.startsWith("matrufsc:campusData")) continue;
            localStorage.removeItem(key);
        }
    } catch {}
}
cleanupLegacyCampusDataLocalStorage();
