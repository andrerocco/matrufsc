import {
    createContext,
    createEffect,
    createSignal,
    onMount,
    untrack,
    useContext,
    type Accessor,
    type JSXElement,
} from "solid-js";
import { usePlano, type Materia } from "../plano/Plano.store";
import { createSearchParam } from "~/lib/createSearchParam";
import { campusDataQuery } from "~/lib/campusDataQuery";
import { getDisciplinaFromJSON, type JSONDisciplina } from "~/context/plano/parser";
import { parseMaterias, serializeMaterias, type URLMateria } from "./url-parser";

const MATERIAS_URL_PARAM = "m";

const UrlStateContext = createContext<{ loading: Accessor<boolean> }>();

export function UrlStateProvider(props: { children?: JSXElement }) {
    const { materias, setMaterias } = usePlano();

    const [urlMaterias, setUrlMaterias] = createSearchParam(MATERIAS_URL_PARAM);
    const [ready, setReady] = createSignal(false);

    createEffect(() => {
        if (!ready()) return;

        const materiasString = serializeMaterias(materias) ?? "";
        const currentUrlMaterias = untrack(urlMaterias);

        if (materiasString !== currentUrlMaterias) setUrlMaterias(materiasString, { replace: true });
    });

    onMount(async () => {
        const materiasString = urlMaterias();
        if (!materiasString) {
            setReady(true);
            return;
        }

        try {
            const parsedMaterias = parseMaterias(materiasString);
            const remoteMaterias = await queryMaterias(parsedMaterias);
            setMaterias(remoteMaterias);
        } catch (error) {
            console.error("Failed to hydrate materias from URL:", error);
        } finally {
            setReady(true);
        }
    });

    // TODO: Update selected campus/semester based on URL
    return <UrlStateContext.Provider value={{ loading: () => !ready() }}>{props.children}</UrlStateContext.Provider>;
}

type MateriaQueryGroup = {
    campus: URLMateria["campus"];
    semester: string;
    materias: URLMateria[];
};

async function queryMaterias(parsedUrlMaterias: readonly URLMateria[]): Promise<Materia[]> {
    const groups = materiasByQueryKey(parsedUrlMaterias);
    if (groups.length === 0) return [];

    // Fetch remote data for each unique campus-semester combination in the URL
    const sources = groups.map((group) => ({
        campus: group.campus,
        semester: group.semester,
    }));
    const campusDataByKey = await campusDataQuery.getMany(sources);

    const disciplinaIndexByKey = new Map<string, Map<string, JSONDisciplina>>();
    for (const [key, campusData] of campusDataByKey) {
        disciplinaIndexByKey.set(key, createDisciplinaIndex(campusData.disciplinas));
    }

    // TODO: Store errors and display then to warn about invalid URL entries
    // Search each URL materia in the fetched data and reconstruct the Materia objects
    const materias: Materia[] = [];
    const visitedIds = new Set<string>();

    for (const materia of parsedUrlMaterias) {
        if (visitedIds.has(materia.id)) continue;

        const sourceKey = campusDataQuery.key({ campus: materia.campus, semester: materia.semester });
        const disciplinaIndex = disciplinaIndexByKey.get(sourceKey);
        if (!disciplinaIndex) continue;

        const disciplina = disciplinaIndex.get(materia.id);
        if (!disciplina) continue;

        const parsedMateria = getDisciplinaFromJSON(disciplina, materia.campus, materia.semester);
        parsedMateria.selected = materia.selected; // update selection state from URL

        // Update turma selection based on URL
        if (materia.unselectedTurmas.length > 0) {
            const unselectedTurmas = new Set(materia.unselectedTurmas);
            for (const turma of parsedMateria.turmas) {
                if (unselectedTurmas.has(turma.id)) turma.selected = false;
            }
        }

        materias.push(parsedMateria);
        visitedIds.add(parsedMateria.id);
    }

    return materias;
}

function materiasByQueryKey(materias: readonly URLMateria[]): MateriaQueryGroup[] {
    const map = new Map<string, MateriaQueryGroup>();

    for (const materia of materias) {
        const key = `${materia.campus}:${materia.semester}`;
        const group = map.get(key) ?? { campus: materia.campus, semester: materia.semester, materias: [] };
        group.materias.push(materia);
        map.set(key, group);
    }

    return [...map.values()];
}

function createDisciplinaIndex(disciplinas: JSONDisciplina[]) {
    const index = new Map<string, JSONDisciplina>();
    for (const disciplina of disciplinas) {
        index.set(disciplina[0], disciplina);
    }
    return index;
}

export function useUrlState() {
    const context = useContext(UrlStateContext);
    if (!context) throw new Error("useUrlState must be used within a UrlStateProvider");
    return context;
}
