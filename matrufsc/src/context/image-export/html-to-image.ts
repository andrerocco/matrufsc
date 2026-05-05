// Lazy load `html-to-image` to reduce initial bundle size, as it's only needed during export.
let toPngPromise: Promise<typeof import("html-to-image").toPng> | undefined;
const getToPng = () => (toPngPromise ??= import("html-to-image").then((m) => m.toPng));

export function waitForAnimationFrame() {
    return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export async function waitForFrames(frames: number) {
    for (let i = 0; i < frames; i += 1) {
        await waitForAnimationFrame();
    }
}

export async function captureElementToPng(
    element: HTMLElement,
    options: { backgroundColor: string; pixelRatio: number },
) {
    const bounds = element.getBoundingClientRect();
    const width = Math.ceil(bounds.width);
    const height = Math.ceil(bounds.height);

    if (width <= 0 || height <= 0) {
        throw new Error("Export container has invalid size.");
    }

    const toPng = await getToPng();

    return toPng(element, {
        cacheBust: true,
        pixelRatio: options.pixelRatio,
        backgroundColor: options.backgroundColor,
        width,
        height,
    });
}

export function loadImage(dataUrl: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Failed to load generated image."));
        image.src = dataUrl;
    });
}

export function composeSquareImage(
    sourceImage: HTMLImageElement,
    options: { size: number; padding: number; backgroundColor: string },
) {
    const canvas = document.createElement("canvas");
    canvas.width = options.size;
    canvas.height = options.size;

    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("Failed to create image context.");
    }

    context.fillStyle = options.backgroundColor;
    context.fillRect(0, 0, options.size, options.size);

    const availableSize = options.size - options.padding * 2;
    const scale = Math.min(availableSize / sourceImage.width, availableSize / sourceImage.height);
    const drawWidth = Math.round(sourceImage.width * scale);
    const drawHeight = Math.round(sourceImage.height * scale);
    const offsetX = Math.round((options.size - drawWidth) / 2);
    const offsetY = Math.round((options.size - drawHeight) / 2);

    context.drawImage(sourceImage, offsetX, offsetY, drawWidth, drawHeight);

    return canvas.toDataURL("image/png");
}

export function downloadDataUrl(dataUrl: string, filename: string) {
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = filename;
    anchor.click();
}
