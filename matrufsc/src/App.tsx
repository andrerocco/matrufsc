import { createEffect, createSignal, createResource } from "solid-js";
import { makePersisted } from "@solid-primitives/storage";
import {
    getDisciplinaFromJSON,
    type JSONCampus,
    type JSONCampusCode,
    type JSONDisciplina,
} from "~/context/plano/parser";
import { usePlano } from "~/context/plano/Plano.store";
// Components
import Header from "~/components/header/Header";
import Footer from "~/components/footer/Footer";
import Search from "~/components/search/Search";
import Materias from "~/components/materias/Materias";
import Horarios from "~/components/horarios/Horarios";

const CAMPUS: { title: string; value: JSONCampusCode }[] = [
    { title: "Florianópolis", value: "FLO" },
    { title: "Joinville", value: "JOI" },
    { title: "Curitibanos", value: "CBS" },
    { title: "Araranguá", value: "ARA" },
    { title: "Blumenau", value: "BLU" },
];

type SemesterOption = { title: string; value: string };

const fetchSemesterIndex = async (): Promise<SemesterOption[]> => {
    const resp = await fetch(`${import.meta.env.BASE_URL}data/index.json`);
    const json = await resp.json();
    return json.semesters;
};

export default function App() {
    const { addMateria } = usePlano();

    const [semesterOptions] = createResource(fetchSemesterIndex);
    const [campus, setCampus] = makePersisted(createSignal<JSONCampusCode>(CAMPUS[0].value));
    const [semester, setSemester] = createSignal("");

    createEffect(() => {
        const opts = semesterOptions();
        if (opts && opts.length > 0 && semester() === "") {
            setSemester(opts[0].value);
        }
    });

    const [data, setData] = createSignal<JSONCampus>();
    const [loading, setLoading] = createSignal(true);
    const disciplinas = () => (loading() ? [] : (data()?.disciplinas ?? []));

    createEffect(() => {
        const sem = semester();
        if (!sem) return;
        const ano = sem.slice(0, 4);
        setLoading(true);
        fetch(`${import.meta.env.BASE_URL}data/${ano}/${sem}-${campus()}.json`)
            .then((response) => response.json())
            .then((data) => setData(data ?? []))
            .catch((error) => console.error(error))
            .finally(() => setLoading(false));
    });

    const handleSelectMateria = (disciplina: JSONDisciplina) => {
        const parsedMateria = getDisciplinaFromJSON(disciplina);
        const error = addMateria(parsedMateria);
        if (error) {
            alert(error.message); // TODO: Lidar visualmente
            return;
        }
    };

    return (
        <div class="mx-auto w-full max-w-[1000px] py-8">
            <Header
                class="mx-6 mb-8"
                campusOptions={CAMPUS}
                campusValue={campus()}
                onCampusChange={setCampus}
                semesterOptions={semesterOptions() ?? []}
                semesterValue={semester()}
                onSemesterChange={setSemester}
            />
            <main>
                <Search
                    class="mx-6"
                    placeholder={loading() ? "Carregando..." : "Pesquisar disciplina"} // TODO: Melhorar loading
                    disabled={loading()}
                    limit={10}
                    data={disciplinas()}
                    onSelect={handleSelectMateria}
                    getLabel={(disciplina) => `${disciplina[0]} - ${disciplina[2]}`}
                />
                <Materias class="mx-6 mt-6" />
                <div class="w-full overflow-x-auto">
                    <Horarios class="my-8 px-6" />
                </div>
            </main>
            <Footer class="mt-2" />
        </div>
    );
}
