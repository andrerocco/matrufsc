import { useEffect, useState } from "react";
import useLocalStorageState from "use-local-storage-state";
import { getDisciplinaFromJSON, type JSONCampus, type JSONDisciplina } from "./providers/plano/parser";
import { usePlanoStore } from "./providers/plano/store";
import Materias from "./components/materias/Materias";
import Search from "./components/search/Search";
import Footer from "./components/footer/Footer";
import Header from "./components/header/Header";
import Horarios from "./components/horarios/Horarios";

const CAMPUS = [
    { title: "Florianópolis", value: "FLO" },
    { title: "Joinvile", value: "JOI" },
    { title: "Curitibanos", value: "CBS" },
    { title: "Araranguá", value: "ARA" },
    { title: "Blumenal", value: "BLN" },
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

function App() {
    const addMateria = usePlanoStore((state) => state.addMateria);

    const [campus, setCampus] = useLocalStorageState("matrufsc_campus", { defaultValue: CAMPUS[0].value });
    const [semester, setSemester] = useState("20242");
    const [data, setData] = useState<JSONCampus>();

    useEffect(() => {
        fetch(`${import.meta.env.BASE_URL}data/${semester}.json`) // TODO: Query by campus, once set user will rarely ever change to a new campus
            .then((response) => {
                return response.json();
            })
            .then((data) => {
                setData(data);
            })
            .catch((error) => {
                console.error(error);
            });
    }, [semester]);

    const handleSelectMateria = (disciplina: JSONDisciplina) => {
        const materia = getDisciplinaFromJSON(disciplina);
        const error = addMateria(materia);

        if (error) {
            alert(error.message); // TODO: Handle visually
            return;
        }
    };

    return (
        <div className="mx-auto w-full max-w-[1000px] px-6 py-8">
            <Header
                campusOptions={CAMPUS}
                campusValue={campus}
                onCampusChange={setCampus}
                semesterOptions={SEMESTER_OPTIONS}
                semesterValue={semester}
                onSemesterChange={setSemester}
            />
            <main>
                {/* <Search data={data?.FLO ?? []} onSelect={handleSelectMateria} /> */}
                {data?.FLO && (
                    <Search
                        placeholder="Pesquisar disciplina"
                        limit={10}
                        data={data?.FLO}
                        onSelect={handleSelectMateria}
                        getLabel={(disciplina) => `${disciplina[0]} - ${disciplina[2]}`}
                    />
                )}
                <Materias />
                <Horarios />
            </main>
            <Footer />
        </div>
    );
}
export default App;
