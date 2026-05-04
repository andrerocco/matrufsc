import { createEffect, createResource, createSignal } from "solid-js";
import { makePersisted } from "@solid-primitives/storage";
import { createPersistedSignal } from "~/lib/createPersistedSignal";
import { createCachedResource } from "~/lib/createCachedResource";
// Context
import { campusDataQuery } from "~/context/campusData/query";
import { usePlano } from "~/context/plano/Plano.store";
import { MateriaExistsError } from "~/context/plano/errors";
import { getDisciplinaFromJSON, type JSONDisciplina } from "~/context/plano/parser";
import type { JSONCampusCode } from "~/context/campusData/types";
// Components
import Header from "~/components/header/Header";
import Footer from "~/components/footer/Footer";
import Search from "~/components/search/Search";
import { searchDisciplinas } from "~/components/search/searchDisciplinas";
import Materias from "~/components/materias/Materias";
import Turmas from "~/components/turmas/Turmas";
import Horarios from "~/components/horarios/Horarios";
import CombinacaoSpinner from "./components/horarios/CombinacaoSpinner";

const CAMPUS: { title: string; value: JSONCampusCode }[] = [
    { title: "Florianópolis", value: "FLO" },
    { title: "Joinville", value: "JOI" },
    { title: "Curitibanos", value: "CBS" },
    { title: "Araranguá", value: "ARA" },
    { title: "Blumenau", value: "BLN" },
];

export default function App() {
    const { addMateria, materias } = usePlano();

    const [semesterOptions] = createResource(fetchAvailableSemesters, {
        storage: createPersistedSignal("matrufsc:semesterOptions"),
    });
    const [semester, setSemester] = createSignal(semesterOptions()?.[0] ?? undefined);

    const [campus, setCampus] = makePersisted(createSignal<JSONCampusCode>(CAMPUS[0].value), {
        name: "matrufsc:campus",
    });
    const [campusData] = createCachedResource(() => {
        const semesterValue = semester();
        const campusValue = campus();
        if (!semesterValue || !campusValue) return null; // blocks fetching
        return { semester: semesterValue, campus: campusValue };
    }, campusDataQuery);
    const disciplinas = () => campusData()?.disciplinas ?? [];

    createEffect(() => {
        const options = semesterOptions();
        if (!options) return;
        const current = semester();
        if (current && options.some((option) => option === current)) return;
        setSemester(options[0] ?? "");
    });

    const handleSelectMateria = (disciplina: JSONDisciplina, campus: string, semester: string) => {
        const parsedMateria = getDisciplinaFromJSON(disciplina, campus, semester);
        try {
            addMateria(parsedMateria);
        } catch (error) {
            if (error instanceof MateriaExistsError) {
                alert(error.message); // TODO: Lidar visualmente
                return;
            }
            throw error;
        }
    };

    return (
        <div class="flex min-h-dvh w-full flex-col py-8">
            <div class="mx-auto w-full max-w-[1000px] shrink-0 px-6">
                <Header
                    class="mb-8"
                    campusOptions={CAMPUS}
                    campusValue={campus()}
                    onCampusChange={setCampus}
                    semesterOptions={semesterOptions()}
                    semesterValue={semester()}
                    onSemesterChange={setSemester}
                    showExportOptions={materias.length > 0}
                />
            </div>
            <main>
                <div class="mx-auto max-w-[1000px] px-6">
                    <Search
                        placeholder={
                            semesterOptions.loading || campusData.loading
                                ? campusData()
                                    ? "Pesquisar disciplina (atualizando...)"
                                    : "Carregando disciplinas..."
                                : "Pesquisar disciplina"
                        }
                        disabled={(semesterOptions.loading || campusData.loading) && !campusData()}
                        limit={10}
                        data={disciplinas()}
                        filter={(search) => searchDisciplinas(search, disciplinas())}
                        onSelect={(materia) => {
                            const sem = semester();
                            if (sem) handleSelectMateria(materia, campus(), sem);
                        }}
                        getLabel={(disciplina) => `${disciplina[0]} - ${disciplina[2]}`}
                    />
                    <Materias class="mt-6" />
                </div>
                <div class="my-4 flex flex-col items-center gap-3 lg:my-8">
                    <div class="w-full overflow-x-auto px-6">
                        <div class="mx-auto flex w-max gap-6">
                            <Horarios />
                            <Turmas class="min-w-[520px]" />
                        </div>
                    </div>
                    <CombinacaoSpinner />
                </div>
            </main>
            <div class="mx-auto w-full max-w-[1000px] shrink-0 px-6">
                <Footer class="mt-2" />
            </div>
        </div>
    );
}

async function fetchAvailableSemesters(): Promise<string[]> {
    try {
        const resp = await fetch(`${import.meta.env.BASE_URL}data/index.json`);
        if (!resp.ok) throw new Error(`Failed to load semesters: ${resp.status} ${resp.statusText}`);
        const json = await resp.json();
        return json.semesters?.sort().reverse() ?? [];
    } catch (error) {
        console.error("Error fetching semesters:", error);
        throw error;
    }
}
