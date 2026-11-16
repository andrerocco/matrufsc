import { batch, createSignal, createEffect, createMemo, Index, Show, on, onCleanup, onMount } from "solid-js";
import { clsx } from "clsx";
import { useClickOutside } from "./useClickOutside";
import {
    EMPTY,
    convertKey,
    deleteBackward,
    deleteForward,
    deleteRange,
    editingAt,
    escapeChip,
    insertText,
    isEmpty,
    leaveChip,
    lineLength,
    moveCaret,
    reopenChip,
    restoreChip,
    selectValue,
    typeText,
    type EditingChip,
    type Line,
    type SearchRow,
    type Segment,
    type TokenKey,
    type TokenValue,
} from "./searchLine";
import { normalize } from "./normalize";
import {
    VALUE_CLASS,
    nameOffsetAt,
    placeCaret,
    rangePoints,
    readLine,
    renderLine,
    selectionPoints,
    type Point,
} from "./searchLineDom";

export default function Search<T>(props: {
    onSelect: (item: T) => void;
    getLabel: (item: T) => string;
    filter: (segments: Segment[]) => SearchRow<T>[];
    placeholder?: string;
    limit: number;
    disabled?: boolean;
    class?: string;
}) {
    let lineRef: HTMLDivElement | undefined;
    let listRef: HTMLDivElement | undefined;
    let componentRef: HTMLDivElement | undefined;
    let enterHeld = false;
    let composing = false;

    const [open, setOpen] = createSignal(false);
    const [focusedIndex, setFocusedIndex] = createSignal(0);
    const [segments, setSegments] = createSignal<Segment[]>(EMPTY.segments);
    const [caret, setCaret] = createSignal(EMPTY.caret);
    const [shownAmount, setShownAmount] = createSignal(props.limit);

    const line = (): Line => ({ segments: segments(), caret: caret() });
    const rows = createMemo(() => props.filter(segments()));
    const rowsShown = () => rows().slice(0, shownAmount());
    const displayShowMore = () => rows().length > shownAmount();
    const totalShownAmount = () => rowsShown().length + (displayShowMore() ? 1 : 0);
    const editingKey = () => editingAt(segments())?.segment.key;
    const editing = () => editingKey() !== undefined;
    const focused = () => lineRef !== undefined && document.activeElement === lineRef;

    useClickOutside(
        () => componentRef,
        () => setOpen(false),
        open,
    );

    const apply = (next: Line) => {
        if (!lineRef) return;
        if (next.segments !== segments()) {
            batch(() => {
                setSegments(next.segments);
                setShownAmount(props.limit);
                setFocusedIndex(0);
            });
            renderLine(lineRef, next.segments);
        }
        setCaret(next.caret);
        if (focused()) placeCaret(lineRef, next.segments, next.caret);
    };

    const focusLine = () => {
        if (!lineRef || props.disabled) return;
        lineRef.focus();
        placeCaret(lineRef, segments(), caret());
    };

    const close = () => {
        apply(EMPTY);
        setOpen(false);
        enterHeld = false;
    };

    const select = (row: SearchRow<T>) => {
        if (row.kind === "item") {
            props.onSelect(row.item);
            return;
        }
        apply(selectValue(line(), row.key, row.value));
        focusLine();
    };

    const positionsOf = (points: Point[]): [number, number] => {
        const { positions } = readLine(lineRef!, segments(), points);
        if (positions.length === 0) return [caret(), caret()];
        return [Math.min(...positions), Math.max(...positions)];
    };

    // The browser never edits the line itself: each intent becomes a model transition and the line is drawn
    // again from the model, so chips stay atomic and the caret lands where the model says. Composition (dead
    // keys, mobile keyboards) cannot be intercepted, so it runs natively and is read back when it ends.
    const handleBeforeInput = (e: InputEvent) => {
        if (!lineRef || composing || e.isComposing || e.inputType.includes("Composition")) return;
        e.preventDefault();
        const current = line();
        const selection = () => positionsOf(selectionPoints(lineRef!));
        const target = () => {
            const [range] = e.getTargetRanges?.() ?? [];
            return positionsOf(range ? rangePoints(range) : selectionPoints(lineRef!));
        };
        const transferred = () => e.dataTransfer?.getData("text/plain") || e.data || "";

        switch (e.inputType) {
            case "insertText": {
                const [from, to] = selection();
                apply(typeText(deleteRange(current, from, to), e.data ?? ""));
                break;
            }
            case "insertFromPaste":
            case "insertFromDrop": {
                const [from, to] = selection();
                apply(insertText(deleteRange(current, from, to), transferred()));
                break;
            }
            case "insertReplacementText": {
                const [from, to] = target();
                apply(insertText(deleteRange(current, from, to), transferred()));
                break;
            }
            case "deleteContentBackward": {
                const [from, to] = selection();
                apply(from === to ? deleteBackward(current) : deleteRange(current, from, to));
                break;
            }
            case "deleteContentForward": {
                const [from, to] = selection();
                apply(from === to ? deleteForward(current) : deleteRange(current, from, to));
                break;
            }
            default: {
                if (!e.inputType.startsWith("delete")) break;
                const [from, to] = target();
                apply(deleteRange(current, from, to));
            }
        }
    };

    const readBack = () => {
        if (!lineRef) return;
        const { segments: read, positions } = readLine(lineRef, segments(), selectionPoints(lineRef));
        const next: Line = { segments: read, caret: positions[1] ?? lineLength(read) };
        const grew = lineLength(read) > lineLength(segments());
        apply((grew && convertKey(next)) || next);
    };

    const handleInput = (e: InputEvent) => {
        if (!composing && !e.isComposing) readBack();
    };

    // A chip the caret leaves closes as the value its text names exactly, the one it was reopened from
    // first; with no such value its literal text is handed back, like Escape.
    const resolveLeaving = (open: EditingChip): TokenValue | undefined => {
        const value = normalize(open.value);
        if (!value) return undefined;
        if (open.reopened && normalize(open.reopened.nome) === value) return open.reopened;
        for (const row of rows()) if (row.kind === "token" && normalize(row.value.nome) === value) return row.value;
        return undefined;
    };

    const leaveTo = (position: number) => {
        const open = editingAt(segments());
        if (!open) return;
        apply(leaveChip(line(), resolveLeaving(open.segment), position)!);
    };

    const syncCaret = () => {
        if (!lineRef || composing || !focused()) return;
        const points = selectionPoints(lineRef);
        if (points.length === 0) return;
        const [, position] = readLine(lineRef, segments(), points).positions;
        const open = editingAt(segments());
        if (open && (position < open.start || position > open.end)) {
            leaveTo(position);
        } else if (position !== caret()) {
            setCaret(position);
        }
    };

    // A click on a closed chip's name reopens it with the caret where the click landed, the way Backspace
    // after it does; a click on its key puts the caret before the chip. A chip open elsewhere is left first.
    const handleMouseDown = (e: MouseEvent) => {
        if (!lineRef || props.disabled || e.button !== 0 || e.shiftKey) return;
        const chipEl = (e.target as Element).closest<HTMLElement>("[data-chip]");
        if (!chipEl || !lineRef.contains(chipEl)) return;
        const chip = segments()[Number(chipEl.dataset.chip)];
        if (chip?.kind !== "chip" || chip.status !== "closed") return;
        e.preventDefault();
        const [start] = positionsOf([{ node: chipEl, offset: 0 }]);
        const open = editingAt(segments());
        const left = open ? leaveChip(line(), resolveLeaving(open.segment), start)! : { ...line(), caret: start };
        const offset = nameOffsetAt(chipEl, e.clientX, e.clientY);
        apply(offset === undefined ? left : (reopenChip(left, left.caret, offset) ?? left));
        focusLine();
    };

    onMount(() => {
        if (lineRef) renderLine(lineRef, segments());
        document.addEventListener("selectionchange", syncCaret);
    });
    onCleanup(() => document.removeEventListener("selectionchange", syncCaret));

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.isComposing) return;
        if (e.key == "ArrowUp") {
            setFocusedIndex((prev) => (prev - 1 + totalShownAmount()) % totalShownAmount());
            e.preventDefault();
        } else if (e.key == "ArrowDown") {
            setFocusedIndex((prev) => (prev + 1) % totalShownAmount());
            e.preventDefault();
        } else if (e.key == "Enter") {
            e.preventDefault();
            if (e.repeat || enterHeld) return;
            enterHeld = true;
            if (focusedIndex() === shownAmount()) {
                handleShowMore();
                return;
            }
            const row = rows()[focusedIndex()];
            if (row) select(row);
        } else if (e.key == "Escape") {
            const next = restoreChip(line()) ?? escapeChip(line());
            if (next) {
                apply(next);
                return;
            }
            close();
            lineRef?.blur();
        } else if (
            (e.key == "ArrowLeft" || e.key == "ArrowRight") &&
            !e.shiftKey &&
            !e.altKey &&
            !e.metaKey &&
            !e.ctrlKey
        ) {
            e.preventDefault();
            const delta = e.key == "ArrowLeft" ? -1 : 1;
            const open = editingAt(segments());
            if (open && caret() === (delta < 0 ? open.start : open.end)) leaveTo(caret());
            else apply(moveCaret(line(), delta));
        }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
        if (e.key == "Enter") {
            enterHeld = false;
        }
    };

    const handleShowMore = () => {
        setShownAmount(shownAmount() + props.limit);
        setFocusedIndex(totalShownAmount() - 1);
    };

    // Keep the focused index valid when the rows change under it (e.g. campus data refresh)
    createEffect(
        on(
            rows,
            () => {
                setFocusedIndex((prev) => (prev >= rows().length ? Math.max(0, rows().length - 1) : prev));
                enterHeld = false;
            },
            { defer: true },
        ),
    );

    // Scroll focused element into view
    createEffect(
        on(focusedIndex, () => {
            if (!listRef) return;
            const focusedElement = listRef.querySelector(`[data-index="${focusedIndex()}"]`) as HTMLElement;
            if (focusedElement) focusedElement.scrollIntoView({ block: "nearest" });
        }),
    );

    return (
        <div ref={componentRef} class={clsx(props.class)}>
            <div class="relative w-full">
                <div
                    class={clsx(
                        "relative flex h-9 w-full items-center border border-neutral-400 px-3 focus-within:border-neutral-600",
                        open() ? "rounded-t-md pr-9" : "rounded-md",
                        props.disabled ? "bg-neutral-200" : "bg-white",
                    )}
                    onClick={(e) => {
                        if (!lineRef?.contains(e.target as Node)) focusLine();
                    }}
                >
                    <div
                        ref={lineRef}
                        contenteditable={props.disabled ? "false" : "true"}
                        role="textbox"
                        aria-label={props.placeholder}
                        spellcheck={false}
                        autocorrect="off"
                        autocapitalize="off"
                        onKeyDown={handleKeyDown}
                        onKeyUp={handleKeyUp}
                        onMouseDown={handleMouseDown}
                        onBeforeInput={handleBeforeInput}
                        onInput={handleInput}
                        onCompositionStart={() => {
                            composing = true;
                        }}
                        onCompositionEnd={() => {
                            composing = false;
                            readBack();
                        }}
                        onFocus={() => setOpen(true)}
                        onBlur={() => {
                            enterHeld = false;
                        }}
                        class="h-9 min-w-0 flex-1 overflow-x-auto overflow-y-hidden leading-9 whitespace-pre outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    />
                    <Show when={props.placeholder && isEmpty(segments())}>
                        <span class="pointer-events-none absolute left-3 text-neutral-400">{props.placeholder}</span>
                    </Show>
                </div>
                <Show when={open()}>
                    <button
                        onClick={close}
                        class="absolute top-0 right-0 h-9 cursor-pointer px-3 text-lg text-neutral-700 hover:text-black hover:underline"
                    >
                        x
                    </button>
                </Show>
            </div>

            <Show when={open()}>
                <div
                    ref={listRef}
                    class="max-h-[calc(22rem+1px)] w-full overflow-y-auto rounded-b-md border border-t-0 border-neutral-400 bg-white"
                >
                    <Index each={rowsShown()}>
                        {(row, index) => (
                            <SearchItem
                                {...rowView(row(), editing(), props.getLabel)}
                                isSelected={focusedIndex() === index}
                                onMouseEnter={() => setFocusedIndex(index)}
                                onClick={() => select(row())}
                                dataIndex={index}
                            />
                        )}
                    </Index>

                    <Show when={rows().length === 0}>
                        <SearchEmptyItem message={emptyMessage(editingKey())} />
                    </Show>

                    <Show when={displayShowMore()}>
                        <SearchShowMore
                            isSelected={focusedIndex() === shownAmount()}
                            onClick={handleShowMore}
                            onMouseEnter={() => setFocusedIndex(shownAmount())}
                            dataIndex={shownAmount()}
                        />
                    </Show>
                </div>
            </Show>
        </div>
    );
}

const EMPTY_BY_KEY: Record<TokenKey, string> = {
    curso: "Nenhum curso encontrado.",
    professor: "Nenhum professor encontrado.",
    departamento: "Nenhum departamento encontrado.",
};

function emptyMessage(key: TokenKey | undefined): string {
    return key ? EMPTY_BY_KEY[key] : "Nenhuma disciplina ou professor foi encontrado.";
}

interface RowView {
    text?: string;
    prefix?: string;
    value?: string;
}

// A suggested filter reads like the chip it produces: the key as plain text and the value tinted. While a chip
// is being edited the rows are its values alone.
function rowView<T>(row: SearchRow<T>, editing: boolean, getLabel: (item: T) => string): RowView {
    if (row.kind === "item") return { text: getLabel(row.item) };
    return editing ? { text: row.value.nome } : { prefix: `${row.key}:`, value: row.value.nome };
}

function SearchItem(
    props: RowView & { isSelected: boolean; onMouseEnter?: () => void; onClick?: () => void; dataIndex: number },
) {
    return (
        <div
            class={clsx("flex h-8 cursor-pointer items-center px-3", props.isSelected && "bg-neutral-200")}
            onMouseEnter={props.onMouseEnter}
            onClick={props.onClick}
            data-index={props.dataIndex}
        >
            <p class="min-w-0 truncate">
                {props.text}
                {props.prefix}
                <Show when={props.value}>
                    <span class={VALUE_CLASS}>{props.value}</span>
                </Show>
            </p>
        </div>
    );
}

function SearchEmptyItem(props: { message: string }) {
    return (
        <div class="flex min-h-8 items-center justify-center px-3 data-[selected='true']:bg-neutral-200">
            <p class="text-neutral-400">{props.message}</p>
        </div>
    );
}

function SearchShowMore(props: {
    isSelected?: boolean;
    onClick?: () => void;
    onMouseEnter?: () => void;
    dataIndex: number;
}) {
    return (
        <button
            class={`h-8 w-full cursor-pointer px-3 text-center text-blue-600 hover:underline ${props.isSelected ? "bg-neutral-200" : ""}`}
            onClick={props.onClick}
            onMouseEnter={props.onMouseEnter}
            data-index={props.dataIndex}
        >
            Carregar mais...
        </button>
    );
}
