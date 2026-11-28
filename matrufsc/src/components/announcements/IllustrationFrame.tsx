import { createSignal, onCleanup, onMount } from "solid-js";
import clsx from "clsx";
import type { Announcement } from "./items";

// Illustrations are drawn for the card's width, so frames of any other width zoom them to fit.
const CARD_WIDTH = 232;

export default function IllustrationFrame(props: { announcement: Announcement; class?: string }) {
    let frame!: HTMLDivElement;
    const [zoom, setZoom] = createSignal(1);
    onMount(() => {
        const observer = new ResizeObserver(([entry]) => setZoom(entry.contentRect.width / CARD_WIDTH));
        observer.observe(frame);
        onCleanup(() => observer.disconnect());
    });

    return (
        <div ref={frame} inert class={clsx("relative overflow-hidden bg-[#eeeeee]", props.class)}>
            <div class="absolute inset-0" style={{ zoom: zoom() }}>
                {props.announcement.illustration()}
            </div>
        </div>
    );
}
