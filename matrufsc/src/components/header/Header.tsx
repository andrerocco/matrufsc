import clsx from "clsx";
import { createSignal, For, Show, type Resource } from "solid-js";
import { useClickOutside } from "../search/useClickOutside";
import { useImageExport } from "../export/ImageExport";

export type SelectOption = { title: string; value: string };

export default function Header(props: {
    class?: string;
    // Campus
    campusOptions: SelectOption[];
    campusValue: string;
    onCampusChange: (value: string) => void;
    // Semester
    semesterOptions?: SelectOption[];
    semesterValue?: string;
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
                        <Show
                            when={props.semesterOptions && props.semesterOptions.length > 0}
                            fallback={<PlaceholderSemesterSelect />}
                        >
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
                        </Show>
                    </div>
                </div>
                <Show when={props.showExportOptions}>
                    <ExportOptions />
                </Show>
            </div>
        </header>
    );
}

function PlaceholderSemesterSelect(props: { loading?: boolean }) {
    function getUfscSemesterPlaceholder(referenceDate: Date = new Date()): SelectOption {
        const year = referenceDate.getFullYear();
        const month = referenceDate.getMonth() + 1;
        const day = referenceDate.getDate();

        const formatSemesterOption = (year: number, semesterNumber: 1 | 2): SelectOption => ({
            value: `${year}${semesterNumber}`,
            title: `${year}.${semesterNumber}`,
        });

        // UFSC's 2025/2026 academic calendars place semester turnover around mid-July and mid-December.
        if (month === 12 && day >= 12) return formatSemesterOption(year + 1, 1);
        if (month > 7 || (month === 7 && day >= 14)) return formatSemesterOption(year, 2);
        return formatSemesterOption(year, 1);
    }

    return (
        <select
            disabled
            class={clsx(
                "bg-transparent opacity-35 focus:border-transparent focus:outline-none",
                props.loading ? "cursor-progress" : "cursor-not-allowed",
            )}
        >
            <option value="">{getUfscSemesterPlaceholder().title}</option>
        </select>
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

    const handleExportImage = async () => {
        await exportImage();
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
                    {isExportingImage() ? "Exportando..." : "Exportar imagem"}
                </button>
                <button class="link cursor-pointer" disabled={true} title="Em desenvolvimento...">
                    Compartilhar link
                </button>
            </Show>
        </div>
    );
}
