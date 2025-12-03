import { createEffect, createSignal } from "solid-js";
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

const SEMESTER_OPTIONS = [
    {
        title: "2024.2",
        value: "20242",
    },
    {
        title: "2024.1",
        value: "20241",
    },
];

export default function App() {
    const { addMateria } = usePlano();

    const [campus, setCampus] = makePersisted(createSignal<JSONCampusCode>(CAMPUS[0].value));
    const [semester, setSemester] = createSignal(SEMESTER_OPTIONS[0].value);

    const [data, setData] = createSignal<JSONCampus>(); // TODO: Melhorar nome
    const [loading, setLoading] = createSignal(true);
    const disciplinas = () => (loading() ? [] : (data()?.disciplinas ?? [])); // TODO: Melhorar nome

    createEffect(() => {
        setLoading(true);
        fetch(`${import.meta.env.BASE_URL}data/2024/${semester()}-${campus()}.json`) // TODO: Cache this JSON? But has to handle updates...
            .then((response) => {
                return response.json();
            })
            .then((data) => {
                console.log("Fetched data:", data);
                setData(data ?? []);
            })
            .catch((error) => {
                console.error(error);
            })
            .finally(() => {
                setLoading(false);
            });
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
        <div class="mx-auto w-full max-w-[1000px] px-6 py-8">
            <Header
                campusOptions={CAMPUS}
                campusValue={campus()}
                onCampusChange={setCampus}
                semesterOptions={SEMESTER_OPTIONS}
                semesterValue={semester()}
                onSemesterChange={setSemester}
            />
            <main>
                <Search
                    placeholder={loading() ? "Carregando..." : "Pesquisar disciplina"} // TODO: Melhorar loading
                    disabled={loading()}
                    limit={10}
                    data={disciplinas()}
                    onSelect={handleSelectMateria}
                    getLabel={(disciplina) => `${disciplina[0]} - ${disciplina[2]}`}
                />
                <Materias />
                <Horarios />
            </main>
            <Footer />
        </div>
    );
}
