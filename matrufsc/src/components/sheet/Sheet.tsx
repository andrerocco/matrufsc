import Drawer from "@corvu/drawer";
import clsx from "clsx";
import { createEffect, createSignal, onCleanup, type JSX } from "solid-js";
import { closeLayer, openLayer } from "./layerHistory";
import { viewport } from "~/lib/media";

const TOP_GAP = 12;
// How far a flick carries the sheet, in ms of its release speed.
const MOMENTUM_MS = 250;
// Only while the library animates: a transition at other times also animates its first measurement, and drags.
const EASE =
    "data-transitioning:duration-500 data-transitioning:ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:data-transitioning:duration-0";
// The same timing, for what changes along with a sheet as it opens and closes.
export const WITH_SHEET = "duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:duration-0";

export interface SheetHandle {
    rest: () => void;
}

// What is inside opts out of dragging the sheet with the library's `data-corvu-no-drag`.
export default function Sheet(props: {
    open: boolean;
    onClose: () => void;
    label: string;
    // The height it opens at, to be dragged up to full height from there. Without one it opens at full height.
    rest?: number;
    // Stays in the page while closed, so what is inside can take focus within the tap that opens it.
    keepMounted?: boolean;
    trapFocus?: boolean;
    // Leaves what stands behind the sheet as it is, instead of dimming it.
    bare?: boolean;
    // Its content ends in white, like a list, rather than in the sheet's grey.
    whiteFoot?: boolean;
    header?: JSX.Element;
    children: JSX.Element;
    ref?: (handle: SheetHandle) => void;
}) {
    const [snap, setSnap] = createSignal<"closed" | "rest" | "full">("closed");
    const [content, setContent] = createSignal<HTMLElement>();
    props.ref?.({ rest: () => snap() === "full" && setSnap("rest") });

    createEffect(() => {
        if (!props.open) return;
        const close = () => props.onClose();
        openLayer(close);
        onCleanup(() => closeLayer(close));
    });

    const height = () => viewport().height - TOP_GAP;
    const restPoint = (): 1 | `${number}px` => (props.rest ? `${props.rest}px` : 1);
    let position: { translate: number } | undefined;

    return (
        <Drawer
            open={props.open}
            onOpenChange={(open) => !open && props.onClose()}
            snapPoints={props.rest ? [0, restPoint(), 1] : [0, 1]}
            defaultSnapPoint={restPoint()}
            activeSnapPoint={snap() === "closed" ? 0 : snap() === "rest" ? restPoint() : 1}
            onActiveSnapPointChange={(point) => setSnap(point === 0 ? "closed" : point === 1 ? "full" : "rest")}
            // The library multiplies the offset by this to pick a snap point: land where the flick would carry it.
            velocityFunction={(distance, time) => {
                const translate = position?.translate;
                return translate ? (translate + (distance / time) * MOMENTUM_MS) / translate : 1;
            }}
            // Let go of the page as soon as the sheet is told to close, not when its exit animation ends.
            preventScroll={props.open}
            noOutsidePointerEvents={props.open}
            trapFocus={props.trapFocus}
            // Not the first button inside, which Enter or Space would then press.
            initialFocusEl={content()}
            preventScrollbarShift={false}
        >
            {(drawer) => {
                position = drawer;
                const shown = () => Math.min(1, (height() * drawer.openPercentage) / (props.rest ?? height()));
                const visible = () => props.open || drawer.isTransitioning;

                return (
                    <Drawer.Portal forceMount={props.keepMounted}>
                        <Drawer.Overlay
                            forceMount={props.keepMounted}
                            class={clsx(
                                "fixed inset-0 z-40",
                                !props.bare && "bg-black/30",
                                "data-transitioning:transition-opacity",
                                EASE,
                                !visible() && "invisible",
                            )}
                            style={{ opacity: shown() }}
                        />
                        <Drawer.Content
                            ref={setContent}
                            forceMount={props.keepMounted}
                            aria-label={props.label}
                            inert={!props.open}
                            class={clsx(
                                "fixed inset-x-0 z-50 mx-auto flex max-w-[calc(1000px-3rem)] flex-col rounded-t-[12px] border border-b-0 border-neutral-400 bg-neutral-100 outline-none sm:inset-x-6",
                                "pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] data-transitioning:transition-transform",
                                EASE,
                                !visible() && "invisible",
                            )}
                            style={{ top: `${viewport().top + TOP_GAP}px`, height: `${height()}px` }}
                        >
                            <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[11px]">
                                <div class="relative shrink-0">
                                    <div class="absolute top-[5px] left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-neutral-400" />
                                    {props.header}
                                </div>
                                {props.children}
                                {/* Keeps the content's end above the screen's while the sheet rests below full height */}
                                <div
                                    class="shrink-0"
                                    style={{
                                        height: `${Math.min(drawer.translate, height() - (props.rest ?? height()))}px`,
                                    }}
                                />
                            </div>
                            {/* The sheet goes on under its foot, down past the screen's, for what shows there: the
                                    stretch of a pull past full height, the keyboard's see-through bars above it, and,
                                    for a moment as the keyboard closes, the room it leaves before the sheet grows. */}
                            <div
                                aria-hidden="true"
                                class={clsx(
                                    "absolute -inset-x-px top-full h-lvh border-x border-neutral-400",
                                    props.whiteFoot ? "bg-white" : "bg-neutral-100",
                                )}
                            />
                        </Drawer.Content>
                    </Drawer.Portal>
                );
            }}
        </Drawer>
    );
}
