import clsx from "clsx";
import { createSignal, For, onCleanup, Show } from "solid-js";
import { writeClipboard } from "@solid-primitives/clipboard";
import { useClickOutside } from "~/components/search/useClickOutside";
import { useImageExport } from "~/context/image-export/ImageExport";

export default function Header(props: {
    class?: string;
    disabled?: boolean;
    // Campus
    campusOptions: { title: string; value: string }[];
    campusValue: string;
    onCampusChange: (value: string) => void;
    // Semester
    semesterOptions?: string[];
    semesterValue?: string;
    onSemesterChange: (value: string) => void;
    // Export options
    showExportOptions: boolean;
}) {
    function formattedSemesterOption(semester: string) {
        if (semester.length !== 5) return semester;
        const year = semester.slice(0, 4);
        const sem = semester.slice(4);
        return `${year}.${sem}`;
    }

    return (
        <header class={clsx(props.class)}>
            <div class="flex justify-between">
                <div class="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                    <h1 class="mr-3">MatrUFSC</h1>
                    <div class="flex gap-4">
                        <select
                            name="campus"
                            id="campus"
                            class="bg-transparent focus:border-transparent focus:outline-none disabled:cursor-progress disabled:opacity-45"
                            disabled={props.disabled}
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
                                class="bg-transparent focus:border-transparent focus:outline-none disabled:cursor-progress disabled:opacity-45"
                                disabled={props.disabled}
                                value={props.semesterValue}
                                onChange={(e) => props.onSemesterChange(e.currentTarget.value)}
                            >
                                <For each={props.semesterOptions}>
                                    {(semester) => (
                                        <option value={semester}>{formattedSemesterOption(semester)}</option>
                                    )}
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
    const currentEstimatedSemester = () => {
        const referenceDate = new Date();
        const year = referenceDate.getFullYear();
        const month = referenceDate.getMonth() + 1;
        const day = referenceDate.getDate();

        // TODO: Melhorar essa estimativa de data
        if (month === 12 && day >= 12) return `${year + 1}.1`; // após 12 de dezembro: primeiro semestre do próximo ano
        if (month > 7 || (month === 7 && day >= 14)) return `${year}.2`; // após 14 de julho: segundo semestre do ano atual
        return `${year}.1`; // caso contrário: primeiro semestre do ano atual
    };

    return (
        <select
            disabled
            class={clsx(
                "bg-transparent opacity-35 focus:border-transparent focus:outline-none",
                props.loading ? "cursor-progress" : "cursor-not-allowed",
            )}
        >
            <option value="">{currentEstimatedSemester()}</option>
        </select>
    );
}

function ExportOptions() {
    const { isExportingImage, exportImage } = useImageExport();

    const [showingExportOptions, setShowingExportOptions] = createSignal(false);
    const [shareStatus, setShareStatus] = createSignal<"idle" | "copied" | "error">("idle");

    let exportOptionsRef: HTMLDivElement | undefined;
    let shareTimeoutId: number | undefined;

    useClickOutside(
        () => exportOptionsRef,
        () => setShowingExportOptions(false),
        showingExportOptions,
    );

    const handleExportImage = async () => {
        await exportImage();
        setShowingExportOptions(false);
    };

    const scheduleShareReset = (delayMs: number) => {
        window.clearTimeout(shareTimeoutId);
        shareTimeoutId = window.setTimeout(() => setShareStatus("idle"), delayMs);
    };

    const handleShareLink = async () => {
        try {
            await writeClipboard(window.location.href);
            setShareStatus("copied");
            scheduleShareReset(1800);
        } catch (error) {
            console.error("Error copying share link:", error);
            setShareStatus("error");
            scheduleShareReset(2400);
        }
    };

    onCleanup(() => {
        window.clearTimeout(shareTimeoutId);
    });

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
                <button class="link cursor-pointer" onClick={handleShareLink} disabled={shareStatus() === "copied"}>
                    {shareStatus() === "copied"
                        ? "Link copiado"
                        : shareStatus() === "error"
                          ? "Erro ao copiar"
                          : "Compartilhar link"}
                </button>
            </Show>
        </div>
    );
}
