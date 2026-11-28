import { batch, createSignal, createEffect, createMemo, Index, Show, on, onCleanup, onMount } from "solid-js";
import { clsx } from "clsx";
import X from "lucide-solid/icons/x";
import Sheet from "~/components/sheet/Sheet";
import { isTouch, viewport } from "~/lib/media";
import { useClickOutside } from "./useClickOutside";
import {
    EMPTY,
    TOKEN_KEYS,
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
    openKey,
    reopenChip,
    restoreChip,
    selectValue,
    selectedValues,
    typeText,
    withoutChips,
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
    // In the sheet an item already picked is marked, and a tap on it removes it.
    picked: (item: T) => boolean;
    onRemove: (item: T) => void;
    getLabel: (item: T) => { code: string; name: string };
    filter: (segments: Segment[]) => SearchRow<T>[];
    filterScope?: unknown;
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
    // What the line was last drawn from: a composition changes the segments without redrawing, and the DOM
    // keeps pointing at these by chip index.
    let rendered: Segment[] = EMPTY.segments;

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
        () => (isTouch() ? undefined : componentRef),
        () => setOpen(false),
        open,
    );

    const changeSegments = (next: Segment[]) =>
        batch(() => {
            setSegments(next);
            setShownAmount(props.limit);
            setFocusedIndex(0);
        });

    const draw = (next: Segment[]) => {
        if (!lineRef || next === rendered) return;
        renderLine(lineRef, next);
        rendered = next;
    };

    const apply = (next: Line) => {
        if (!lineRef) return;
        if (next.segments !== segments()) changeSegments(next.segments);
        draw(next.segments);
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

    // The line takes focus inside the tap, or iOS keeps the keyboard down.
    const openSheet = () => {
        apply(EMPTY);
        setOpen(true);
        focusLine();
    };

    const closeSheet = () => {
        setOpen(false);
        lineRef?.blur();
    };

    // A sheet that mounts already open stays out of sight while it holds the page.
    createEffect(on(isTouch, () => setOpen(false), { defer: true }));

    const picked = (row: SearchRow<T>) => isTouch() && row.kind === "item" && props.picked(row.item);

    const select = (row: SearchRow<T>) => {
        if (row.kind === "item") {
            if (picked(row)) props.onRemove(row.item);
            else props.onSelect(row.item);
            return;
        }
        apply(row.kind === "key" ? openKey(line(), row.key) : selectValue(line(), row.key, row.value));
        focusLine();
    };

    const positionsOf = (points: Point[]): [number, number] => {
        const { positions } = readLine(lineRef!, rendered, points);
        if (positions.length === 0) return [caret(), caret()];
        return [Math.min(...positions), Math.max(...positions)];
    };

    // The browser never edits the line itself: each intent becomes a model transition and the line is drawn
    // again from the model, so chips stay atomic and the caret lands where the model says. Composition (dead
    // keys, mobile keyboards) cannot be intercepted, so it runs natively: it is read on every input, for the
    // list to follow it, and drawn again from the model when it ends.
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
        const { segments: read, positions } = readLine(lineRef, rendered, selectionPoints(lineRef));
        const next: Line = { segments: read, caret: positions[1] ?? lineLength(read) };
        const grew = lineLength(read) > lineLength(rendered);
        apply((grew && convertKey(next)) || next);
    };

    const handleInput = (e: InputEvent) => {
        if (!composing && !e.isComposing) readBack();
        else if (lineRef) changeSegments(readLine(lineRef, rendered, []).segments);
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
        const [, position] = readLine(lineRef, rendered, points).positions;
        const open = editingAt(segments());
        if (open && (position < open.start || position > open.end)) {
            leaveTo(position);
            return;
        }
        if (position !== caret()) setCaret(position);
        // A click just before the open chip leaves the browser's caret outside it, where a composition would land;
        // it goes inside, where the model already has it.
        if (open && document.getSelection()?.isCollapsed && !lineRef.childNodes[open.index]?.contains(points[1].node)) {
            placeCaret(lineRef, segments(), position);
        }
    };

    // A click on a closed chip reopens it, the way Backspace after it does, with the caret where the click landed
    // in its name, or at the start of the name for a click on its key; a click on an open chip's key puts the caret
    // at the start of its value. A chip open elsewhere is left first.
    const handleMouseDown = (e: MouseEvent) => {
        if (!lineRef || props.disabled || e.button !== 0 || e.shiftKey) return;
        const chipEl = (e.target as Element).closest<HTMLElement>("[data-chip]");
        if (!chipEl || !lineRef.contains(chipEl)) return;
        const chip = rendered[Number(chipEl.dataset.chip)];
        if (chip?.kind !== "chip") return;
        const offset = nameOffsetAt(chipEl, e.clientX, e.clientY);
        if (chip.status === "editing") {
            if (offset !== undefined) return;
            e.preventDefault();
            apply({ ...line(), caret: editingAt(segments())!.start });
            focusLine();
            return;
        }
        e.preventDefault();
        const [start] = positionsOf([{ node: chipEl, offset: 0 }]);
        const open = editingAt(segments());
        const left = open ? leaveChip(line(), resolveLeaving(open.segment), start)! : { ...line(), caret: start };
        apply(reopenChip(left, left.caret, offset ?? 0) ?? left);
        focusLine();
    };

    // The line is drawn as it mounts, which a change of layout makes it do again.
    const setLine = (element: HTMLDivElement) => {
        lineRef = element;
        renderLine(element, rendered);
        // Android keyboards then offer no suggestions; Solid types `autocomplete` for form fields only.
        element.setAttribute("autocomplete", "off");
    };

    onMount(() => document.addEventListener("selectionchange", syncCaret));
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
            // The sheet shows no keyboard cursor, so Enter must not remove a row picked before.
            const row = rows()[focusedIndex()];
            if (row && !picked(row)) select(row);
        } else if (e.key == "Escape") {
            e.preventDefault();
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

    // The sheet's list grows as it scrolls instead of offering "Carregar mais".
    const loadMore = () => {
        if (!listRef || !isTouch() || !open() || !displayShowMore()) return;
        if (listRef.scrollTop + listRef.clientHeight >= listRef.scrollHeight - 100) {
            setShownAmount((amount) => amount + props.limit);
        }
    };
    createEffect(on([rowsShown, viewport, open], loadMore));

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

    createEffect(
        on(
            () => props.filterScope,
            () => apply(withoutChips(line())),
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

    // A drag that starts on the empty line moves the sheet; with text in it, the drag is the caret's.
    const lineBox = (lineClass: string) => (
        <>
            <div
                ref={setLine}
                contenteditable={props.disabled ? "false" : "true"}
                role="textbox"
                aria-label={props.placeholder}
                spellcheck={false}
                autocorrect="off"
                autocapitalize="off"
                data-corvu-no-drag={isEmpty(segments()) ? undefined : ""}
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
                class={clsx(
                    "min-w-0 flex-1 overflow-x-auto overflow-y-hidden whitespace-pre outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                    lineClass,
                )}
            />
            <Show when={props.placeholder && isEmpty(segments())}>
                <span class={clsx("pointer-events-none absolute left-3 text-neutral-400", isTouch() && "text-[16px]")}>
                    {props.placeholder}
                </span>
            </Show>
        </>
    );

    const dropdown = () => (
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
                    {lineBox("h-9 leading-9")}
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
                        <SearchEmptyItem message={emptyMessage(segments())} />
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

    return (
        <Show when={isTouch()} fallback={dropdown()}>
            <button
                type="button"
                disabled={props.disabled}
                onClick={openSheet}
                class={clsx(
                    "flex h-9 w-full items-center rounded-md border border-neutral-400 px-3 text-left text-neutral-400",
                    props.disabled ? "bg-neutral-200" : "bg-white",
                    props.class,
                )}
            >
                <span class="truncate">{props.placeholder}</span>
            </button>
            <Sheet
                open={open()}
                onClose={closeSheet}
                label="Pesquisar disciplina"
                whiteFoot
                keepMounted
                trapFocus={false}
                header={
                    <div class="px-3 pt-[19.5px] pb-3">
                        <div class="relative flex h-[44px] items-center rounded-md border border-neutral-400 bg-white pl-3 focus-within:border-neutral-600">
                            {lineBox("h-[44px] text-[16px] leading-[44px]")}
                            <Show when={!isEmpty(segments())}>
                                <button
                                    aria-label="Limpar pesquisa"
                                    data-corvu-no-drag
                                    onMouseDown={keepFocus}
                                    onClick={() => {
                                        apply(EMPTY);
                                        focusLine();
                                    }}
                                    class="flex size-[44px] shrink-0 cursor-pointer items-center justify-center text-[12px] text-neutral-500"
                                >
                                    <X size="1.25em" strokeWidth={1.75} aria-hidden="true" />
                                </button>
                            </Show>
                        </div>
                    </div>
                }
            >
                <div
                    ref={listRef}
                    class="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-neutral-400 bg-white pb-[env(safe-area-inset-bottom)]"
                    onScroll={loadMore}
                >
                    <Index
                        each={rowsShown()}
                        fallback={
                            <p class="flex h-full items-center justify-center px-3 text-center text-neutral-500">
                                {emptyMessage(segments())}
                            </p>
                        }
                    >
                        {(row) => (
                            <SheetItem
                                {...rowView(row(), editing(), props.getLabel)}
                                picked={picked(row())}
                                onClick={() => select(row())}
                            />
                        )}
                    </Index>
                </div>
            </Sheet>
        </Show>
    );
}

const EMPTY_BY_KEY: Record<TokenKey, string> = {
    curso: "Nenhum curso encontrado",
    professor: "Nenhum professor encontrado",
    departamento: "Nenhum departamento encontrado",
};

// With chips on the line a miss may be theirs, so the message says so; with none, it names the filters.
function emptyMessage(segments: Segment[]): string {
    const key = editingAt(segments)?.segment.key;
    const narrowed = TOKEN_KEYS.some((other) => other !== key && selectedValues(segments, other).length > 0);
    if (key) return `${EMPTY_BY_KEY[key]}${narrowed ? " com os outros filtros" : ""}.`;
    if (narrowed) return "Nenhuma disciplina encontrada com esses filtros.";
    return "Nenhuma disciplina encontrada. Para filtrar, digite curso:, professor: ou departamento:";
}

interface RowView {
    code?: string;
    text?: string;
    prefix?: string;
    value?: string;
}

// A suggested filter reads like the chip it produces: the key as plain text and the value tinted, one blank
// space for a key alone. While a chip is being edited the rows are its values alone.
function rowView<T>(
    row: SearchRow<T>,
    editing: boolean,
    getLabel: (item: T) => { code: string; name: string },
): RowView {
    if (row.kind === "item") {
        const { code, name } = getLabel(row.item);
        return { code, text: name };
    }
    if (row.kind === "key") return { prefix: `${row.key}:`, value: "\u00a0" };
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
                {props.code && `${props.code} - `}
                {props.text}
                {props.prefix}
                <Show when={props.value}>
                    <span class={VALUE_CLASS}>{props.value}</span>
                </Show>
            </p>
        </div>
    );
}

// A tap in the sheet leaves the line focused, and so the keyboard up.
const keepFocus = (e: MouseEvent) => e.preventDefault();

function SheetItem(props: RowView & { picked: boolean; onClick: () => void }) {
    return (
        <div
            class={clsx(
                "flex min-h-[44px] cursor-pointer items-center border-b px-3 py-2.5",
                props.picked ? "border-white/25 bg-blue-600 text-white" : "border-neutral-300",
            )}
            onMouseDown={keepFocus}
            onClick={props.onClick}
        >
            <p class="min-w-0 flex-1 break-words">
                <Show when={props.code}>
                    <span class="mr-[1ch]">{props.code}</span>
                </Show>
                {props.text}
                {props.prefix}
                <Show when={props.value}>
                    <span class={VALUE_CLASS}>{props.value}</span>
                </Show>
            </p>
            <Show when={props.picked}>
                <span class="sr-only">Adicionada</span>
            </Show>
        </div>
    );
}

function SearchEmptyItem(props: { message: string }) {
    return (
        <div class="flex min-h-8 items-center justify-center px-3 data-[selected='true']:bg-neutral-200">
            <p class="text-center text-neutral-400">{props.message}</p>
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
