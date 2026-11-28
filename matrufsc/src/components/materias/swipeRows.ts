const ACTION = 74; // px of the action that stay showing on an open row
const DECIDE = 5; // px a touch travels before its direction tells a swipe from a scroll
const HOLD = 200; // ms a touch rests on a control in a row before the control gets it
const FULL = 0.55; // share of the row's width past which letting go removes it
const FLICK = 0.3; // px/ms from which the direction of the release decides, whatever the distance
const TOP_SPEED = 2000; // px/s
const SNAP = 0.35; // seconds
const CLOSE = 0.25;

const springs = new WeakMap<HTMLElement, () => void>();
let open: HTMLElement | undefined;
let swiping = false;
let handed = false;
let busy = false;

const revealed = (row: HTMLElement) => parseFloat(row.style.getPropertyValue("--swipe")) || 0;

// `translate` and not `transform`, which dragging a row to reorder it writes.
function reveal(row: HTMLElement, offset: number) {
    const px = Math.round(Math.max(offset, 0) * devicePixelRatio) / devicePixelRatio;
    row.style.translate = px ? `${-px}px` : "";
    row.style.setProperty("--swipe", px ? `${px}px` : "");
}

// A critically damped spring that settles in about `seconds`, starting at `velocity` px/s.
function spring(
    seconds: number,
    from: number,
    to: number,
    velocity: number,
    step: (value: number) => void,
    done?: () => void,
) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        step(to);
        done?.();
        return () => {};
    }

    const omega = (2 * Math.PI) / seconds;
    const origin = performance.now();
    const distance = from - to;
    const pull = velocity + omega * distance;
    let stopped = false;
    let frame = requestAnimationFrame(function tick(now) {
        const time = Math.max(now - origin, 0) / 1000;
        const decay = Math.exp(-omega * time);
        const left = (distance + pull * time) * decay;
        const speed = (velocity - omega * pull * time) * decay;
        if (Math.abs(left) < 0.5 && Math.abs(speed) < 20) {
            step(to);
            done?.();
            return;
        }
        step(to + left);
        if (!stopped) frame = requestAnimationFrame(tick);
    });
    return () => {
        stopped = true;
        cancelAnimationFrame(frame);
    };
}

function settle(row: HTMLElement, to: number, velocity = 0) {
    springs.get(row)?.();
    springs.set(
        row,
        spring(SNAP, revealed(row), to, velocity, (offset) => reveal(row, offset)),
    );
}

function rest(row?: HTMLElement) {
    if (open && open !== row) settle(open, 0);
    open = row;
    if (row) addEventListener("pointerdown", closeOpen, true);
    else removeEventListener("pointerdown", closeOpen, true);
}

// With a row open, a touch anywhere else closes it and does nothing more.
function closeOpen(event: PointerEvent) {
    const target = event.target as Element;
    if (open!.contains(target) && !target.closest("button")) return;
    event.stopPropagation();
    swallowClick();
    rest();
}

// A touch that moved may still end in a click; one that does not must leave the next tap alone.
function swallowClick() {
    const swallow = (event: Event) => {
        event.stopPropagation();
        event.preventDefault();
    };
    addEventListener("click", swallow, { capture: true, once: true });
    addEventListener("pointerdown", () => removeEventListener("click", swallow, true), { capture: true, once: true });
}

function remove(row: HTMLElement, clip: HTMLElement, onRemove: (row: HTMLElement) => void, velocity = 0) {
    busy = true;
    rest();
    springs.get(row)?.();
    clip.style.pointerEvents = "none";

    const width = row.offsetWidth;
    let gone = false;
    let stop = () => {};
    // Aimed past the edge, for the row to leave at speed instead of easing into it.
    stop = spring(SNAP, revealed(row), width * 1.25, velocity, (offset) => {
        reveal(row, Math.min(offset, width));
        if (gone || offset < width) return;
        gone = true;
        stop();
        closeGap(row, clip, onRemove);
    });
}

function closeGap(row: HTMLElement, clip: HTMLElement, onRemove: (row: HTMLElement) => void) {
    const below: HTMLElement[] = [];
    for (let next = row.nextElementSibling; next; next = next.nextElementSibling) below.push(next as HTMLElement);
    const height = clip.offsetHeight;
    // The list is expected to go away with its last row.
    const gap = below.length || row.previousElementSibling ? row.offsetHeight : height;

    spring(
        CLOSE,
        0,
        gap,
        0,
        (closed) => {
            for (const other of below) other.style.translate = `0 ${-closed}px`;
            clip.style.height = `${height - closed}px`;
        },
        () => {
            try {
                if (row.isConnected) onRemove(row);
            } finally {
                for (const other of below) other.style.translate = "";
                clip.style.height = clip.style.pointerEvents = "";
                row.removeAttribute("data-swipe-full");
                reveal(row, 0);
                busy = false;
            }
        },
    );
}

// The row's markup sizes the action a swipe uncovers by `--swipe`, and `data-swipe-full` tells it that letting
// go removes the row. The list needs `touch-action: pan-y`, nothing in it a `touch-action` of its own, and its
// parent to be the box that frames it. Returns what to call when the list goes away.
export function swipeRows(list: HTMLElement, onRemove: (row: HTMLElement) => void) {
    // `touch-action: pan-y` leaves scrolling up and down to the browser, so a touch that is a swipe, or that a
    // control got, holds the page still itself. iOS honours that only from a listener that was there, and not
    // passive, when the touch began.
    list.addEventListener(
        "touchmove",
        (event) => {
            if ((swiping || handed) && event.cancelable) event.preventDefault();
        },
        { passive: false },
    );

    list.addEventListener("pointerdown", (event) => {
        const target = event.target as Element;
        const row = [...list.children].find((child) => child.contains(target)) as HTMLElement | undefined;
        if (!row || busy || !event.isTrusted || !event.isPrimary || event.pointerType === "mouse") return;

        // A control in the row (the handle that reorders it) gets the touch only after it rests there for `HOLD`.
        // A touch that moves sooner swipes the row or scrolls the page, as anywhere else in the list.
        const control = target.closest("button");
        if (control) event.stopPropagation();

        busy = true;
        const clip = list.parentElement!;
        const { pointerId, pointerType, clientX: startX, clientY: startY } = event;
        const width = row.offsetWidth;
        const track: { time: number; x: number }[] = [];
        const gesture = new AbortController();
        const listening = { capture: true, signal: gesture.signal };
        let base = 0;
        let originX = 0;
        let offset = 0;

        const hold = control
            ? setTimeout(() => {
                  handed = true;
                  const from = { pointerId, pointerType, clientX: startX, clientY: startY };
                  control.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, ...from }));
              }, HOLD)
            : undefined;

        const end = () => {
            clearTimeout(hold);
            gesture.abort();
            busy = swiping = handed = false;
        };

        const move = (moved: PointerEvent) => {
            if (moved.pointerId !== pointerId || handed) return;

            if (!swiping) {
                const dx = moved.clientX - startX;
                const dy = moved.clientY - startY;
                if (Math.hypot(dx, dy) < DECIDE) return;

                base = revealed(row);
                if (Math.abs(dx) <= Math.abs(dy) || (!base && dx > 0)) {
                    end();
                    if (open === row) rest();
                    return;
                }
                clearTimeout(hold);
                swiping = true;
                springs.get(row)?.();
                originX = moved.clientX;
            }

            offset = Math.min(Math.max(base + originX - moved.clientX, 0), width);
            track.push({ time: moved.timeStamp, x: moved.clientX });
            reveal(row, offset);
            row.toggleAttribute("data-swipe-full", offset >= width * FULL);
        };

        const release = (released: PointerEvent) => {
            if (released.pointerId !== pointerId) return;
            const swiped = swiping;
            const lifted = released.type === "pointerup";
            end();
            if (lifted && (swiped || open === row)) swallowClick();

            if (!swiped) {
                if (open !== row) return;
                if (lifted && released.clientX > row.getBoundingClientRect().right) remove(row, clip, onRemove);
                else rest();
                return;
            }

            const recent = track.filter((sample) => released.timeStamp - sample.time < 100);
            const elapsed = recent.length > 1 ? recent[recent.length - 1].time - recent[0].time : 0;
            const speed = lifted && elapsed ? (recent[0].x - recent[recent.length - 1].x) / elapsed : 0;
            const velocity = Math.max(-TOP_SPEED, Math.min(speed * 1000, TOP_SPEED));

            if (lifted && offset >= width * FULL) return remove(row, clip, onRemove, velocity);
            row.removeAttribute("data-swipe-full");
            const opens = lifted && (Math.abs(speed) > FLICK ? speed > 0 : offset > ACTION / 2);
            rest(opens ? row : undefined);
            settle(row, opens ? ACTION : 0, velocity);
        };

        addEventListener("pointermove", move, listening);
        addEventListener("pointerup", release, listening);
        addEventListener("pointercancel", release, listening);
    });

    return () => {
        if (open && list.contains(open)) rest();
    };
}
