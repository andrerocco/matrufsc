const EDGE = 72;
const MAX_SCROLL = 14;
const SLOP = 4;
const SETTLE_MS = 200;

let busy = false;

// The handle needs `touch-action: none`, or the browser takes a touch drag for a scroll and cancels it.
export function dragRow(event: PointerEvent, rows: HTMLElement[], from: number, onDrop: (to: number) => void) {
    if (busy || event.button !== 0 || from < 0) return;
    busy = true;
    event.preventDefault();

    const handle = event.currentTarget as HTMLElement;
    const { pointerId } = event;
    const row = rows[from];
    const rects = rows.map((other) => other.getBoundingClientRect());
    const { top, height } = rects[from];
    const startY = event.clientY;
    const startScroll = window.scrollY;
    const listeners = new AbortController();
    let pointerY = startY;
    let to = from;

    handle.setPointerCapture(pointerId);
    row.dataset.dragging = "";
    for (const other of rows) if (other !== row) other.style.transition = `transform ${SETTLE_MS}ms ease`;

    const move = () => {
        const offset = Math.max(
            rects[0].top - top,
            Math.min(pointerY - startY + window.scrollY - startScroll, rects[rects.length - 1].bottom - top - height),
        );
        row.style.transform = `translateY(${offset}px)`;

        to = from;
        rows.forEach((other, index) => {
            const middle = rects[index].top + rects[index].height / 2;
            const shift =
                index < from && top + offset < middle ? 1 : index > from && top + offset + height > middle ? -1 : 0;
            to -= shift;
            if (other !== row) other.style.transform = shift ? `translateY(${shift * height}px)` : "";
        });
    };

    let frame = requestAnimationFrame(function scroll() {
        const past = Math.min(pointerY - EDGE, 0) + Math.max(pointerY - (window.innerHeight - EDGE), 0);
        const travel = pointerY - startY;
        // A press on a row that already sits near an edge must not scroll before the pointer heads there
        if (past * travel > 0 && Math.abs(travel) > SLOP) {
            window.scrollBy(0, Math.max(-MAX_SCROLL, Math.min(past / 4, MAX_SCROLL)));
            move();
        }
        frame = requestAnimationFrame(scroll);
    });

    const settle = (target: number) => {
        listeners.abort();
        cancelAnimationFrame(frame);
        if (!row.isConnected) target = from;

        let landing = 0;
        rows.forEach((other, index) => {
            if (other === row) return;
            const passed = (index - from) * (index - target) <= 0 && index !== from;
            if (passed) landing += rects[index].height * Math.sign(target - from);
            other.style.transform = passed ? `translateY(${-Math.sign(target - from) * height}px)` : "";
        });
        row.style.transition = `transform ${SETTLE_MS}ms ease`;
        row.style.transform = `translateY(${landing}px)`;

        setTimeout(() => {
            for (const other of rows) {
                other.style.transition = "none";
                other.style.transform = "";
            }
            delete row.dataset.dragging;
            if (target !== from && row.isConnected) onDrop(target);
            requestAnimationFrame(() => {
                for (const other of rows) other.style.transition = "";
                busy = false;
            });
        }, SETTLE_MS);
    };

    // On `window`: the handle stops receiving the pointer if its row leaves the list mid-drag
    const on = (type: "pointermove" | "pointerup" | "pointercancel", handler: (pointer: PointerEvent) => void) =>
        window.addEventListener(type, (pointer) => pointer.pointerId === pointerId && handler(pointer), {
            signal: listeners.signal,
        });
    on("pointermove", (moved) => {
        pointerY = moved.clientY;
        move();
    });
    on("pointerup", () => settle(to));
    on("pointercancel", () => settle(from));
}
