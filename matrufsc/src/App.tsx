import { createEffect, createResource, createSignal } from "solid-js";
import { makePersisted } from "@solid-primitives/storage";
import {
    getDisciplinaFromJSON,
    type JSONCampus,
    type JSONCampusCode,
    type JSONDisciplina,
} from "~/context/plano/parser";
import { usePlano } from "~/context/plano/Plano.store";
import { MateriaExistsError } from "~/context/plano/errors";
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
    const { addMateria } = usePlano();

    const [semesterOptions] = createResource(fetchAvailableSemesters);
    const [campus, setCampus] = makePersisted(createSignal<JSONCampusCode>(CAMPUS[0].value));
    const [semester, setSemester] = createSignal("");

    createEffect(() => {
        const opts = semesterOptions();
        if (!opts?.length) return;
        setSemester((current) => current || opts[0].value);
    });

    const [campusData] = createResource(() => {
        const sem = semester();
        if (!sem) return null;
        return { semester: sem, campus: campus() };
    }, fetchCampusData);

    const isLoading = () => semesterOptions.loading || campusData.loading;
    const disciplinas = () => campusData()?.disciplinas ?? [];

    const handleSelectMateria = (disciplina: JSONDisciplina) => {
        const parsedMateria = getDisciplinaFromJSON(disciplina);
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
                    semesterOptions={semesterOptions() ?? []}
                    semesterValue={semester()}
                    onSemesterChange={setSemester}
                />
            </div>
            <main class="flex-1">
                <div class="mx-auto max-w-[1000px] px-6">
                    <Search
                        placeholder={isLoading() ? "Carregando..." : "Pesquisar disciplina"} // TODO: Melhorar loading
                        disabled={isLoading()}
                        limit={10}
                        data={disciplinas()}
                        filter={(search) => searchDisciplinas(search, disciplinas())}
                        onSelect={handleSelectMateria}
                        getLabel={(disciplina) => `${disciplina[0]} - ${disciplina[2]}`}
                    />
                    <Materias class="mt-6" />
                </div>
                <div class="my-8 flex flex-col items-center gap-3">
                    <div class="flex w-full justify-center gap-6 overflow-x-auto px-6 lg:container">
                        <Horarios />
                        <Turmas />
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

async function fetchAvailableSemesters(): Promise<{ title: string; value: string }[]> {
    try {
        const resp = await fetch(`${import.meta.env.BASE_URL}data/index.json`);
        if (!resp.ok) throw new Error(`Failed to load semesters: ${resp.status} ${resp.statusText}`);
        const json = await resp.json();
        return json.semesters ?? [];
    } catch (error) {
        console.error("Error fetching semesters:", error);
        throw error;
    }
}

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
