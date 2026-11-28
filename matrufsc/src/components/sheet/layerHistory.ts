// One history entry stands for the open sheet, so Back closes it on every platform and, with nothing open, a
// single Back leaves the site.
const MARK = "matrufsc:layer";

let closeCurrent: (() => void) | null = null;
let backPending = false;

const marked = () => history.state?.[MARK] === true;
const push = () => history.pushState({ ...history.state, [MARK]: true }, "");

window.addEventListener("popstate", () => {
    if (backPending) {
        backPending = false;
        // A layer opened while the entry was still being dropped gets one of its own.
        if (closeCurrent) push();
    } else if (marked()) {
        // Forward, or a reload, onto an entry whose layer is gone.
        if (!closeCurrent) history.back();
    } else {
        const close = closeCurrent;
        closeCurrent = null;
        close?.();
    }
});

if (marked()) history.back();

export function openLayer(close: () => void) {
    closeCurrent = close;
    if (!backPending) push();
}

export function closeLayer(close: () => void) {
    if (closeCurrent !== close) return;
    closeCurrent = null;
    // The entry already on its way out was the only one: a second Back would leave the site.
    if (backPending) return;
    backPending = true;
    history.back();
}
