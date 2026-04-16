import { createContext, createSignal, Show, type ParentProps, type Accessor, useContext } from "solid-js";
import { useHorariosOverlay } from "~/components/horarios/useHorariosOverlay";
import { captureElementToPng, composeSquareImage, downloadDataUrl, loadImage, waitForFrames } from "./export-image";
import Materias from "~/components/materias/Materias";
import Horarios from "~/components/horarios/Horarios";

const EXPORT_SCALE_FACTOR = 2;
const EXPORT_IMAGE_SIZE = 1080 * EXPORT_SCALE_FACTOR;
const EXPORT_IMAGE_PADDING = 24 * EXPORT_SCALE_FACTOR;
const EXPORT_BG_COLOR = "#eeeeee";

const ImageExportContext = createContext<{
    isExportingImage: Accessor<boolean>;
    exportImage: () => Promise<void>;
}>();

export function ImageExportProvider(props: ParentProps) {
    const { clearOverlay } = useHorariosOverlay();

    const [isExportingImage, setIsExportingImage] = createSignal(false);
    const [shouldRenderCaptureScene, setShouldRenderCaptureScene] = createSignal(false);
    const [captureElement, setCaptureElement] = createSignal<HTMLDivElement>();

    const exportImage = async () => {
        if (isExportingImage()) return;

        setIsExportingImage(true);
        clearOverlay();
        setShouldRenderCaptureScene(true);

        try {
            if (document.fonts?.ready) await document.fonts.ready;
            await waitForFrames(2);

            const contentElement = captureElement();
            if (!contentElement) {
                throw new Error("Export capture scene is not mounted.");
            }

            const sourceDataUrl = await captureElementToPng(contentElement, {
                backgroundColor: EXPORT_BG_COLOR,
                pixelRatio: Math.max(2, EXPORT_SCALE_FACTOR + 1),
            });
            const sourceImage = await loadImage(sourceDataUrl);
            const exportedDataUrl = composeSquareImage(sourceImage, {
                size: EXPORT_IMAGE_SIZE,
                padding: EXPORT_IMAGE_PADDING,
                backgroundColor: EXPORT_BG_COLOR,
            });

            const fileName = `Plano_${formatExportTimestamp(new Date())}.png`;
            downloadDataUrl(exportedDataUrl, fileName);
        } catch (error) {
            console.error("Error exporting image:", error);
            alert("Não foi possível exportar a imagem da combinação atual.");
        } finally {
            setShouldRenderCaptureScene(false);
            setCaptureElement(undefined);
            setIsExportingImage(false);
        }
    };

    return (
        <ImageExportContext.Provider value={{ isExportingImage, exportImage }}>
            {props.children}
            <Show when={shouldRenderCaptureScene()}>
                <div class="pointer-events-none fixed top-0 left-[-10000px]" aria-hidden="true">
                    <div ref={setCaptureElement} class="flex w-fit flex-col gap-6">
                        <div class="max-w-[800px]">
                            <Materias />
                        </div>
                        <div class="mx-auto w-fit">
                            <Horarios />
                        </div>
                    </div>
                </div>
            </Show>
        </ImageExportContext.Provider>
    );
}

function formatExportTimestamp(date: Date) {
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function useImageExport() {
    const context = useContext(ImageExportContext);
    if (!context) {
        throw new Error("useImageExport must be used inside ImageExportProvider.");
    }
    return context;
}
