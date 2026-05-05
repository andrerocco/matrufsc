import { isCampusCode, type JSONCampusCode } from "~/lib/campusDataQuery";
import type { Materia } from "~/context/plano/Plano.store";

interface MateriaOrigin {
    campus: JSONCampusCode;
    semester: string;
}

export interface URLMateria extends MateriaOrigin {
    id: string;
    selected: boolean;
    unselectedTurmas: string[];
}

const SOURCE_SEPARATOR = ".";
const GROUP_SEPARATOR = "__";
const MATERIA_SEPARATOR = "_";
const UNSELECTED_SEPARATOR = "*";

const SEMESTER_PATTERN = /^\d{5}$/;

/// Parsing

export function parseMaterias(urlParamString: string): URLMateria[] {
    const materias: URLMateria[] = [];

    for (const group of urlParamString.split(GROUP_SEPARATOR)) {
        if (!group) continue;

        const [originString, ...materiaStrings] = group.split(MATERIA_SEPARATOR);
        const source = parseMateriaOrigin(originString);
        if (!source) continue;

        for (const materiaString of materiaStrings) {
            const parsedMateria = parseMateria(materiaString, source);
            if (parsedMateria) materias.push(parsedMateria);
        }
    }

    return materias;
}

function parseMateriaOrigin(originString: string): MateriaOrigin | null {
    const [campus, semester, ...extra] = originString.split(SOURCE_SEPARATOR);

    if (extra.length > 0 || !campus || !semester) return null;
    if (!isCampusCode(campus)) return null;
    if (!SEMESTER_PATTERN.test(semester)) return null;

    return { campus, semester };
}

function parseMateria(materiaString: string, origin: MateriaOrigin): URLMateria | null {
    if (!materiaString) return null;

    const selected = !materiaString.startsWith(UNSELECTED_SEPARATOR);
    const materiaWithTurmas = selected ? materiaString : materiaString.slice(UNSELECTED_SEPARATOR.length);
    const [materiaId, ...unselectedTurmaIds] = materiaWithTurmas.split(UNSELECTED_SEPARATOR);

    if (!materiaId) return null;

    return {
        id: materiaId,
        selected,
        unselectedTurmas: unselectedTurmaIds.filter(Boolean),
        ...origin,
    };
}

/// Serialize

export function serializeMaterias(materias: readonly Materia[]): string | null {
    const groups: string[] = [];
    let currentOrigin = "";
    let currentMateriasStrings: string[] = [];

    function flushGroup() {
        if (!currentOrigin || currentMateriasStrings.length === 0) return;
        groups.push(`${currentOrigin}${MATERIA_SEPARATOR}${currentMateriasStrings.join(MATERIA_SEPARATOR)}`);
    }

    for (const materia of materias) {
        const originString = serializeMateriaOrigin(materia.campus, materia.semester);
        const materiaString = serializeMateria(materia);

        if (originString !== currentOrigin) {
            flushGroup();
            currentOrigin = originString;
            currentMateriasStrings = [];
        }

        currentMateriasStrings.push(materiaString);
    }

    flushGroup();

    return groups.length > 0 ? groups.join(GROUP_SEPARATOR) : null;
}

function serializeMateriaOrigin(campus: string, semester: string) {
    return `${campus}${SOURCE_SEPARATOR}${semester}`;
}

function serializeMateria(materia: Materia) {
    const prefix = materia.selected ? "" : UNSELECTED_SEPARATOR;
    const unselectedTurmas = materia.turmas
        .filter((turma) => !turma.selected)
        .map((turma) => `${UNSELECTED_SEPARATOR}${turma.id}`)
        .join("");

    return `${prefix}${materia.id}${unselectedTurmas}`;
}
