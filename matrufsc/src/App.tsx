import { createEffect, createMemo, createResource, createSignal, Show } from "solid-js";
import clsx from "clsx";
import { makePersisted } from "@solid-primitives/storage";
import { createPersistedSignal } from "~/lib/createPersistedSignal";
import { createCachedResource } from "~/lib/createCachedResource";
// Context
import { campusDataQuery } from "~/lib/campusDataQuery";
import { usePlano } from "~/context/plano/Plano.store";
import { MateriaExistsError } from "~/context/plano/errors";
import { getDisciplinaFromJSON } from "~/data/parse";
import type { JSONCampus, JSONCampusCode, JSONDisciplina } from "~/data/schema";
import { useUrlState } from "~/context/url/UrlState";
import { setUserProperties, track } from "~/lib/analytics";
// Components
import Header from "~/components/header/Header";
import Footer from "~/components/footer/Footer";
import Search from "~/components/search/Search";
import { indexDisciplinas, searchRows } from "~/components/search/searchDisciplinas";
import { buildCatalogo } from "~/components/search/catalogo";
import { disciplinaNome } from "~/lib/nomeCompleto";
import Materias from "~/components/materias/Materias";
import Turmas from "~/components/turmas/Turmas";
import Horarios from "~/components/horarios/Horarios";
import TouchStage from "~/components/horarios/TouchStage";
import CombinacaoSpinner from "./components/horarios/CombinacaoSpinner";
import Announcements from "~/components/announcements/Announcements";
import UndoToast from "~/components/materias/UndoToast";
import LostCombinacaoToast from "~/components/horarios/LostCombinacaoToast";
import { WITH_SHEET } from "~/components/sheet/Sheet";
import { isTouch } from "~/lib/media";

const CAMPUS: { title: string; value: JSONCampusCode }[] = [
    { title: "Florianópolis", value: "FLO" },
    { title: "Joinville", value: "JOI" },
    { title: "Curitibanos", value: "CBS" },
    { title: "Araranguá", value: "ARA" },
    { title: "Blumenau", value: "BLN" },
];

export default function App() {
    const { addMateria, removeMateria, materias } = usePlano();
    const { loading: urlStateLoading } = useUrlState();

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
    const searchIndex = createMemo(() => indexDisciplinas(campusData()));
    const catalogo = createMemo(() => buildCatalogo(campusData()));

    createEffect(() => {
        const options = semesterOptions();
        if (!options) return;
        const current = semester();
        if (current && options.some((option) => option === current)) return;
        setSemester(options[0] ?? "");
    });

    createEffect(() => {
        const sem = semester();
        if (sem) setUserProperties({ campus: campus(), semestre: sem });
    });

    const handleSelectMateria = (data: JSONCampus, disciplina: JSONDisciplina, campus: string, semester: string) => {
        const parsedMateria = getDisciplinaFromJSON(disciplina, campus, semester, data.cursos);
        try {
            // On a touch screen the turmas open over the search, so they wait for a tap on the matéria.
            addMateria(parsedMateria, !isTouch());
            track("materia_adicionada", {
                materias_no_plano: materias.length,
                departamento: parsedMateria.id.slice(0, 3),
            });
        } catch (error) {
            if (error instanceof MateriaExistsError) {
                alert(error.message); // TODO: Lidar visualmente
                return;
            }
            throw error;
        }
    };

    const [lift, setLift] = createSignal(0);

    return (
        <>
            <div
                class={clsx(
                    "flex min-h-dvh w-full flex-col",
                    isTouch() ? ["pt-2 transition-[translate]", WITH_SHEET] : "py-8 max-sm:pt-4",
                )}
                style={{ translate: lift() ? `0 ${-lift()}px` : undefined }}
            >
                <div class="px-safe-4 sm:px-safe-6 mx-auto w-full max-w-[1000px] shrink-0">
                    <Header
                        class={isTouch() ? "mb-1" : "mb-8 max-sm:mb-5"}
                        campusOptions={CAMPUS}
                        campusValue={campus()}
                        onCampusChange={setCampus}
                        semesterOptions={semesterOptions()}
                        semesterValue={semester()}
                        onSemesterChange={setSemester}
                        disabled={urlStateLoading()}
                        showExportOptions={!isTouch() && materias.length > 0}
                    />
                </div>
                <main class={clsx(isTouch() && "flex flex-1 flex-col")}>
                    <div class="px-safe-4 sm:px-safe-6 mx-auto w-full max-w-[1000px]">
                        <Search
                            placeholder={
                                urlStateLoading()
                                    ? "Carregando disciplinas..."
                                    : semesterOptions.loading || campusData.loading
                                      ? campusData()
                                          ? "Pesquisar disciplina (atualizando...)"
                                          : "Carregando disciplinas..."
                                      : "Pesquisar disciplina"
                            }
                            disabled={
                                urlStateLoading() || ((semesterOptions.loading || campusData.loading) && !campusData())
                            }
                            limit={10}
                            filter={(segments) => searchRows(segments, searchIndex(), catalogo())}
                            filterScope={campus()}
                            onSelect={(disciplina) => {
                                const data = campusData();
                                const sem = semester();
                                if (data && sem) handleSelectMateria(data, disciplina, campus(), sem);
                            }}
                            getLabel={(disciplina) => ({
                                code: disciplina[0],
                                name: disciplinaNome(disciplina, campusData()?.cursos ?? {}),
                            })}
                            picked={(disciplina) => materias.some((materia) => materia.id === disciplina[0])}
                            onRemove={(disciplina) => removeMateria(disciplina[0])}
                        />
                        <Show when={!isTouch()}>
                            <Materias class="mt-6 max-sm:mt-4" />
                        </Show>
                    </div>
                    <Show when={!isTouch()} fallback={<TouchStage onLift={setLift} />}>
                        <div class="my-4 flex flex-col items-center gap-3 lg:my-8">
                            <div class="px-safe-6 w-full overflow-x-auto">
                                <div class="mx-auto flex w-max gap-6">
                                    <Horarios />
                                    <Turmas class="min-w-[520px]" />
                                </div>
                            </div>
                            <CombinacaoSpinner />
                        </div>
                    </Show>
                </main>
                <Show when={!isTouch()}>
                    <div class="px-safe-4 sm:px-safe-6 mx-auto w-full max-w-[1000px] shrink-0">
                        <Footer class="mt-2 max-sm:mt-6" />
                    </div>
                </Show>
            </div>
            {/* Outside the page, whose `translate` would become what the toast is fixed to */}
            <UndoToast />
            <LostCombinacaoToast />
            <Announcements />
        </>
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
