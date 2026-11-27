import { createSignal, createEffect, For, Show, on } from "solid-js";
import { clsx } from "clsx";
import { useClickOutside } from "./useClickOutside";

export default function Search<T>(props: {
    data: T[];
    onSelect: (item: T) => void;
    getLabel: (item: T) => string;
    filter: (search: string) => T[];
    placeholder?: string;
    limit: number;
    disabled?: boolean;
    class?: string;
}) {
    let inputRef: HTMLInputElement | undefined;
    let listRef: HTMLDivElement | undefined;
    let componentRef: HTMLDivElement | undefined;
    let navigationSource = "keyboard";
    let pointer = { x: -1, y: -1 };
    let enterHeld = false;

    const [open, setOpen] = createSignal(false);
    const [focusedIndex, setFocusedIndex] = createSignal(0);
    const [searchValue, setSearchValue] = createSignal("");

    const [dataShownAmount, setDataShownAmount] = createSignal(props.limit);
    const [filteredData, setFilteredData] = createSignal(props.data);
    const filteredDataShown = () => filteredData().slice(0, dataShownAmount());
    const hasMore = () => filteredData().length > dataShownAmount();

    useClickOutside(
        () => componentRef,
        () => setOpen(false),
        open,
    );

    const close = () => {
        if (inputRef) {
            inputRef.value = "";
            setSearchValue("");
        }
        setOpen(false);
        setDataShownAmount(props.limit);
        setFocusedIndex(0);
        setFilteredData(props.filter(searchValue()));
        enterHeld = false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key == "ArrowUp") {
            navigationSource = "keyboard";
            const last = filteredDataShown().length - 1;
            // Only wrap to the end once the whole list is loaded
            if (last >= 0) setFocusedIndex((prev) => (prev > 0 ? prev - 1 : hasMore() ? 0 : last));
            e.preventDefault();
        } else if (e.key == "ArrowDown") {
            navigationSource = "keyboard";
            if (focusedIndex() === filteredDataShown().length - 1) showMore();
            const shown = filteredDataShown().length;
            if (shown > 0) setFocusedIndex((prev) => (prev + 1) % shown);
            e.preventDefault();
        } else if (e.key == "Enter") {
            if (e.repeat || enterHeld) {
                e.preventDefault();
                return;
            }
            enterHeld = true;
            e.preventDefault();
            const item = filteredData()[focusedIndex()];
            if (item) props.onSelect(item);
        } else if (e.key == "Escape") {
            close();
            inputRef?.blur();
        }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
        if (e.key == "Enter") {
            enterHeld = false;
        }
    };

    const handleInput = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const search = target.value;
        navigationSource = "keyboard";
        setSearchValue(search);
        setDataShownAmount(props.limit);
        setFilteredData(props.filter(search));
        setFocusedIndex(0);
        if (listRef) listRef.scrollTop = 0;
    };

    const showMore = () => {
        if (hasMore()) setDataShownAmount(dataShownAmount() + props.limit);
    };

    // Scrolling fires mouseenter under a still pointer, which would steal focus from arrow-key navigation
    const handleItemHover = (e: MouseEvent, index: number) => {
        if (e.screenX !== pointer.x || e.screenY !== pointer.y) navigationSource = "mouse";
        pointer = { x: e.screenX, y: e.screenY };
        if (navigationSource === "mouse") setFocusedIndex(index);
    };

    const handleScroll = () => {
        if (!listRef) return;
        const remaining = listRef.scrollHeight - listRef.scrollTop - listRef.clientHeight;
        if (remaining < listRef.clientHeight) showMore();
    };

    // Update filtered data if original data changes, trying to preserve the focused index
    createEffect(
        on(
            () => props.data,
            () => {
                setFilteredData(props.filter(searchValue()));
                setFocusedIndex((prev) =>
                    prev >= filteredData().length ? Math.max(0, filteredData().length - 1) : prev,
                );
                enterHeld = false;
            },
        ),
    );

    // Scroll focused element into view (hovering a partially visible row must not move the list)
    createEffect(
        on(focusedIndex, () => {
            if (!listRef || navigationSource === "mouse") return;
            const focusedElement = listRef.querySelector(`[data-index="${focusedIndex()}"]`) as HTMLElement;
            if (focusedElement) focusedElement.scrollIntoView({ block: "nearest" });
        }),
    );

    return (
        <div ref={componentRef} class={clsx(props.class)}>
            <div class="relative w-full">
                <input
                    type="text"
                    name="search"
                    autocomplete="off"
                    ref={inputRef}
                    disabled={props.disabled}
                    placeholder={props.placeholder}
                    onKeyDown={handleKeyDown}
                    onKeyUp={handleKeyUp}
                    onInput={handleInput}
                    onFocus={() => setOpen(true)}
                    onBlur={() => {
                        enterHeld = false;
                    }}
                    value={searchValue()}
                    class={clsx(
                        "h-9 w-full border border-neutral-400 bg-white px-3 focus:border-neutral-600 focus:outline-none disabled:bg-neutral-200",
                        open() ? "rounded-t-md" : "rounded-md",
                    )}
                />
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
                    onScroll={handleScroll}
                    class="max-h-[calc(21rem+1px)] w-full overflow-y-auto rounded-b-md border border-t-0 border-neutral-400 bg-white"
                >
                    <For each={filteredDataShown()}>
                        {(item, index) => (
                            <SearchItem
                                label={props.getLabel(item)}
                                isSelected={focusedIndex() === index()}
                                onHover={(e) => handleItemHover(e, index())}
                                onClick={() => props.onSelect(item)}
                                dataIndex={index()}
                            />
                        )}
                    </For>

                    <Show when={filteredData().length === 0}>
                        <SearchEmptyItem />
                    </Show>
                </div>
            </Show>
        </div>
    );
}

function SearchItem(props: {
    label: string;
    isSelected: boolean;
    onHover?: (e: MouseEvent) => void;
    onClick?: () => void;
    dataIndex: number;
}) {
    return (
        <div
            class={clsx("flex h-8 cursor-pointer items-center px-3", props.isSelected && "bg-neutral-200")}
            onMouseEnter={props.onHover}
            onMouseMove={props.onHover}
            onClick={props.onClick}
            data-index={props.dataIndex}
        >
            <p class="overflow-hidden text-ellipsis whitespace-nowrap">{props.label}</p>
        </div>
    );
}

function SearchEmptyItem() {
    return (
        <div class="flex min-h-8 items-center justify-center px-3 data-[selected='true']:bg-neutral-200">
            <p class="text-neutral-400">Nenhuma disciplina ou professor foi encontrado.</p>
        </div>
    );
}
