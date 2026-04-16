import clsx from "clsx";
import { createSignal, For, Show } from "solid-js";
import { useClickOutside } from "../search/useClickOutside";
import { useImageExport } from "../export/ImageExport";

export default function Header(props: {
    class?: string;
    // Campus
    campusOptions: { title: string; value: string }[];
    campusValue: string;
    onCampusChange: (value: string) => void;
    // Semester
    semesterOptions: { title: string; value: string }[];
    semesterValue: string;
    onSemesterChange: (value: string) => void;
    // Export options
    showExportOptions: boolean;
}) {
    return (
        <header class={clsx(props.class)}>
            <div class="flex justify-between">
                <div class="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                    <h1 class="mr-3">MatrUFSC</h1>
                    <div class="flex gap-4">
                        <select
                            name="campus"
                            id="campus"
                            class="bg-transparent focus:border-transparent focus:outline-none"
                            value={props.campusValue}
                            onChange={(e) => props.onCampusChange(e.currentTarget.value)}
                        >
                            <For each={props.campusOptions}>
                                {(campus) => <option value={campus.value}>{campus.title}</option>}
                            </For>
                        </select>
                        <select
                            name="semester"
                            id="semester"
                            class="bg-transparent focus:border-transparent focus:outline-none"
                            value={props.semesterValue}
                            onChange={(e) => props.onSemesterChange(e.currentTarget.value)}
                        >
                            <For each={props.semesterOptions}>
                                {(semester) => <option value={semester.value}>{semester.title}</option>}
                            </For>
                        </select>
                    </div>
                </div>
                <Show when={props.showExportOptions}>
                    <ExportOptions />
                </Show>
            </div>
        </header>
    );
}

function ExportOptions() {
    const { isExportingImage, exportImage } = useImageExport();

    const [showingExportOptions, setShowingExportOptions] = createSignal(false);

    let exportOptionsRef: HTMLDivElement | undefined;

    useClickOutside(
        () => exportOptionsRef,
        () => setShowingExportOptions(false),
        showingExportOptions,
    );

    const handleExportImage = () => {
        exportImage();
        setShowingExportOptions(false);
    };

    return (
        <div ref={exportOptionsRef} class="flex gap-7">
            <Show
                when={showingExportOptions()}
                fallback={
                    <button class="link cursor-pointer" onClick={() => setShowingExportOptions(true)}>
                        Salvar
                    </button>
                }
            >
                <button class="link cursor-pointer" onClick={handleExportImage} disabled={isExportingImage()}>
                    Exportar imagem
                </button>
                <button class="link cursor-pointer" disabled={true} title={"Funcionalidade em desenvolvimento"}>
                    Compartilhar link
                </button>
            </Show>
        </div>
    );
}
