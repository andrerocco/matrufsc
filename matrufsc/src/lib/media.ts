import { createSignal } from "solid-js";

function mediaQuery(query: string) {
    const list = window.matchMedia(query);
    const [matches, setMatches] = createSignal(list.matches);
    list.addEventListener("change", (event) => setMatches(event.matches));
    return matches;
}

export const isPhone = mediaQuery("(max-width: 639.98px)");
// The layout follows the pointer alone, whatever the screen's size: a touch screen gets the page packed around
// the grid, with the turmas in a sheet, and a mouse the desktop page.
export const isTouch = mediaQuery("(pointer: coarse)");

// The part of the window the on-screen keyboard leaves visible.
const visual = window.visualViewport;
const readViewport = () => ({ top: visual?.offsetTop ?? 0, height: visual?.height ?? window.innerHeight });
const [viewport, setViewport] = createSignal(readViewport());
const syncViewport = () => setViewport(readViewport());
visual?.addEventListener("resize", syncViewport);
visual?.addEventListener("scroll", syncViewport);
export { viewport };

// The smallest the browser's bars leave the window.
const probe = document.createElement("div");
probe.style.cssText = "position:fixed;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none";
document.documentElement.append(probe);
const [smallHeight, setSmallHeight] = createSignal(probe.clientHeight);
new ResizeObserver(() => setSmallHeight(probe.clientHeight)).observe(probe);
export { smallHeight };
