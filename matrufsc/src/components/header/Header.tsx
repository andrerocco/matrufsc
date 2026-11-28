import clsx from "clsx";
import { createSignal, For, onCleanup, Show, type JSX } from "solid-js";
import { writeClipboard } from "@solid-primitives/clipboard";
import ChevronDown from "lucide-solid/icons/chevron-down";
import X from "lucide-solid/icons/x";
import { useClickOutside } from "~/components/search/useClickOutside";
import { useImageExport } from "~/context/image-export/ImageExport";
import { track } from "~/lib/analytics";
import { isTouch } from "~/lib/media";

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
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 class="mr-3 max-sm:mr-auto">MatrUFSC</h1>
                <div class="flex gap-4">
                    <HeaderSelect
                        name="campus"
                        id="campus"
                        class="disabled:cursor-progress disabled:opacity-45"
                        disabled={props.disabled}
                        value={props.campusValue}
                        onChange={(e) => props.onCampusChange(e.currentTarget.value)}
                    >
                        <For each={props.campusOptions}>
                            {(campus) => <option value={campus.value}>{campus.title}</option>}
                        </For>
                    </HeaderSelect>
                    <Show
                        when={props.semesterOptions && props.semesterOptions.length > 0}
                        fallback={<PlaceholderSemesterSelect />}
                    >
                        <HeaderSelect
                            name="semester"
                            id="semester"
                            class="disabled:cursor-progress disabled:opacity-45"
                            disabled={props.disabled}
                            value={props.semesterValue}
                            onChange={(e) => props.onSemesterChange(e.currentTarget.value)}
                        >
                            <For each={props.semesterOptions}>
                                {(semester) => <option value={semester}>{formattedSemesterOption(semester)}</option>}
                            </For>
                        </HeaderSelect>
                    </Show>
                </div>
                <Show when={props.showExportOptions}>
                    <div class="flex justify-end max-sm:basis-full sm:ml-auto">
                        <ExportOptions />
                    </div>
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
        <HeaderSelect disabled class={clsx("opacity-35", props.loading ? "cursor-progress" : "cursor-not-allowed")}>
            <option value="">{currentEstimatedSemester()}</option>
        </HeaderSelect>
    );
}

// On a touch screen the native look changes from system to system and sits off the header's edge.
function HeaderSelect(props: JSX.SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <span class="contents pointer-coarse:relative pointer-coarse:flex pointer-coarse:items-center">
            <select
                {...props}
                class={clsx(
                    "bg-transparent focus:border-transparent focus:outline-none pointer-coarse:appearance-none pointer-coarse:py-2 pointer-coarse:pr-6",
                    props.class,
                )}
            />
            <Show when={isTouch()}>
                <ChevronDown
                    size="1.25em"
                    strokeWidth={1.75}
                    class="pointer-events-none absolute right-0"
                    aria-hidden="true"
                />
            </Show>
        </span>
    );
}

// `data-export-open` lets what shares its row make room for the options.
export function ExportOptions() {
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

    const handleOpenExportOptions = () => {
        track("salvar_aberto");
        setShowingExportOptions(true);
    };

    const handleExportImage = async () => {
        track("salvar_exportar_imagem");
        await exportImage();
        setShowingExportOptions(false);
    };

    const scheduleShareReset = (delayMs: number) => {
        window.clearTimeout(shareTimeoutId);
        shareTimeoutId = window.setTimeout(() => setShareStatus("idle"), delayMs);
    };

    const handleShareLink = async () => {
        track("salvar_compartilhar_link");
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
        <div ref={exportOptionsRef} data-export-open={showingExportOptions() ? "" : undefined} class="flex gap-7">
            <Show
                when={showingExportOptions()}
                fallback={
                    <button class="link cursor-pointer" onClick={handleOpenExportOptions}>
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
                <button
                    class="hit-area-[13px] -ml-3 flex cursor-pointer items-center"
                    aria-label="Fechar"
                    onClick={() => setShowingExportOptions(false)}
                >
                    <X size="1em" strokeWidth={1.75} aria-hidden="true" />
                </button>
            </Show>
        </div>
    );
}
