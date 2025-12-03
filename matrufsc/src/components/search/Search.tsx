import { createSignal, createEffect, createMemo, For, Show, on } from "solid-js";
import { clsx } from "clsx";
import { useClickOutside } from "./useClickOutside";

export default function Search<T>(props: {
    data: T[];
    onSelect: (item: T) => void;
    getLabel: (item: T) => string;
    filter?: (search: string) => T[];
    placeholder?: string;
    limit?: number;
    disabled?: boolean;
}) {
    const [open, setOpen] = createSignal(false);
    const [shownAmount, setShownAmount] = createSignal(props.limit ?? props.data.length);
    const [focusedIndex, setFocusedIndex] = createSignal(0);
    const [filteredData, setFilteredData] = createSignal(props.data);
    const [searchValue, setSearchValue] = createSignal("");

    let inputRef: HTMLInputElement | undefined;
    let listRef: HTMLDivElement | undefined;
    let componentRef: HTMLDivElement | undefined;
    let navigationSource = "keyboard";

    const displayShowMore = createMemo(() => filteredData().length > shownAmount());
    const getShowingAmount = () =>
        Math.min(shownAmount() ?? filteredData().length, filteredData().length) + (displayShowMore() ? 1 : 0);

    useClickOutside(
        () => componentRef,
        () => setOpen(false),
        open,
    );

    const handleClose = () => {
        if (inputRef) {
            inputRef.value = "";
            setSearchValue("");
        }
        setOpen(false);
        setShownAmount(props.limit ?? props.data.length);
        setFocusedIndex(0);
        setFilteredData(props.data);
    };

    createEffect(
        // Scroll focused element into view when navigating with keyboard
        on(focusedIndex, () => {
            if (navigationSource === "keyboard") {
                if (!listRef) return;
                const focusedElement = listRef.querySelector(`[data-index="${focusedIndex()}"]`) as HTMLElement;
                if (focusedElement) focusedElement.scrollIntoView({ block: "nearest" });
            }
        }),
    );

    createEffect(() => {
        handleClose(); // Reset when data changes
    });

    const handleKeyDown = (e: KeyboardEvent) => {
        switch (e.key) {
            case "ArrowUp":
                navigationSource = "keyboard";
                setFocusedIndex((prev) => (prev - 1 + getShowingAmount()) % getShowingAmount());
                e.preventDefault();
                break;
            case "ArrowDown":
                navigationSource = "keyboard";
                setFocusedIndex((prev) => (prev + 1) % getShowingAmount());
                e.preventDefault();
                break;
            case "Enter":
                if (focusedIndex() === shownAmount()) {
                    handleShowMore();
                    break;
                }
                const item = filteredData()[focusedIndex()];
                if (item) props.onSelect(item);
                break;
            case "Escape":
                handleClose();
                break;
            default:
                break;
        }
    };

    const handleInput = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const search = target.value;
        setSearchValue(search);

        if (props.limit) {
            setShownAmount(props.limit);
        }

        if (props.filter) {
            setFilteredData(props.filter(search));
        } else {
            setFilteredData(
                props.data.filter((item) => props.getLabel(item).toLowerCase().includes(search.toLowerCase())),
            );
        }

        setFocusedIndex(0);
    };

    const handleShowMore = () => {
        if (!props.limit) return;
        const newShownAmount = Math.min(shownAmount() + props.limit, filteredData().length);
        setShownAmount(newShownAmount);
        setFocusedIndex(newShownAmount);
        // setTimeout(scrollToListEnd, 0);
    };

    return (
        <div ref={componentRef}>
            <div class="relative w-full">
                <input
                    type="text"
                    name="search"
                    autocomplete="off"
                    ref={inputRef}
                    disabled={props.disabled}
                    placeholder={props.placeholder}
                    onKeyDown={handleKeyDown}
                    onInput={handleInput}
                    onFocus={() => setOpen(true)}
                    value={searchValue()}
                    class={clsx(
                        "h-9 w-full border border-neutral-400 bg-white px-3 focus:border-neutral-600 focus:outline-none disabled:bg-neutral-200",
                        open() ? "rounded-t-md" : "rounded-md",
                    )}
                />
                <Show when={open()}>
                    <button
                        onClick={handleClose}
                        class="absolute top-0 right-0 h-9 -translate-y-0.5 cursor-pointer px-3 text-lg text-neutral-700 hover:text-black hover:underline"
                    >
                        x
                    </button>
                </Show>
            </div>

            <Show when={open()}>
                <div
                    ref={listRef}
                    class="max-h-96 w-full overflow-y-auto rounded-b-md border border-t-0 border-neutral-400 bg-white"
                >
                    <For each={filteredData().slice(0, shownAmount())}>
                        {(item, index) => (
                            <SearchItem
                                label={props.getLabel(item)}
                                isSelected={focusedIndex() === index()}
                                onMouseEnter={() => {
                                    navigationSource = "mouse";
                                    setFocusedIndex(index());
                                }}
                                onClick={() => props.onSelect(item)}
                                dataIndex={index()}
                            />
                        )}
                    </For>

                    <Show when={filteredData().length === 0}>
                        <SearchEmptyItem />
                    </Show>

                    <Show when={displayShowMore()}>
                        <SearchShowMore
                            isSelected={focusedIndex() === shownAmount()}
                            onClick={handleShowMore}
                            onMouseEnter={() => {
                                navigationSource = "mouse";
                                setFocusedIndex(shownAmount());
                            }}
                            dataIndex={shownAmount()}
                        />
                    </Show>
                </div>
            </Show>
        </div>
    );
}

function SearchItem(props: {
    label: string;
    isSelected: boolean;
    onMouseEnter?: () => void;
    onClick?: () => void;
    dataIndex: number;
}) {
    return (
        <div
            class={clsx("flex h-8 cursor-pointer items-center px-3", props.isSelected && "bg-neutral-200")}
            onMouseEnter={props.onMouseEnter}
            onClick={props.onClick}
            data-index={props.dataIndex}
        >
            <p class="overflow-hidden text-ellipsis whitespace-nowrap">{props.label}</p>
        </div>
    );
}

function SearchEmptyItem() {
    return (
        <div class="flex h-8 cursor-pointer items-center px-3 data-[selected='true']:bg-neutral-200">
            <p class="text-center text-neutral-400">Sem resultados</p>
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
            Carregar mais... {props.isSelected ? "👇" : ""}
        </button>
    );
}
