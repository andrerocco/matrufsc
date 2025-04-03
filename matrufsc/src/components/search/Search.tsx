import { useState, KeyboardEvent, ChangeEvent, useMemo, memo, useCallback, useEffect, useRef } from "react";
import { cn } from "~/lib/utils";
import { useClickOutside } from "~/components/search/useClickOutside";
import { usePlanoStore } from "~/providers/plano/store"; // Import the store

export default function Search<T>({
    data,
    onSelect,
    getLabel,
    filter,
    placeholder,
    limit,
    disabled,
}: {
    data: T[];
    onSelect: (item: T) => void;
    getLabel: (item: T) => string; // Function to extract the string representation
    filter?: (search: string) => T[]; // Function to filter the items
    placeholder?: string;
    limit?: number;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [shownAmount, setShownAmount] = useState(limit ?? data.length);
    const [focusedIndex, setFocusedIndex] = useState(0);
    const [filteredData, setFilteredData] = useState(data);

    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const listEndRef = useRef<HTMLDivElement>(null);
    const navigationSourceRef = useRef<"keyboard" | "mouse">("keyboard");
    const componentRef = useRef<HTMLDivElement>(null);

    const displayShowMore = filteredData.length > shownAmount;
    const getShowingAmount = () =>
        Math.min(shownAmount ?? filteredData.length, filteredData.length) + (displayShowMore ? 1 : 0);

    useClickOutside(componentRef, () => setOpen(false), open);

    const handleClose = useCallback(() => {
        if (inputRef.current) {
            inputRef.current.value = "";
        }
        setOpen(false);
        setShownAmount(limit ?? data.length);
        setFocusedIndex(0);
        setFilteredData(data);
    }, [data, limit]);

    const scrollFocusedIntoView = useCallback(() => {
        if (!listRef.current) return;

        const focusedElement = listRef.current.querySelector(`[data-index="${focusedIndex}"]`) as HTMLElement;

        if (focusedElement) {
            focusedElement.scrollIntoView({ block: "nearest" });
        }
    }, [focusedIndex]);

    // Scroll focused element into view when navigating with keyboard
    useEffect(() => {
        if (navigationSourceRef.current === "keyboard") {
            scrollFocusedIntoView();
        }
    }, [focusedIndex, scrollFocusedIntoView]);

    useEffect(() => {
        handleClose();
    }, [data]);

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        switch (e.key) {
            case "ArrowUp":
                navigationSourceRef.current = "keyboard";
                setFocusedIndex((prev) => (prev - 1 + getShowingAmount()) % getShowingAmount());
                e.preventDefault();
                break;
            case "ArrowDown":
                navigationSourceRef.current = "keyboard";
                setFocusedIndex((prev) => (prev + 1) % getShowingAmount());
                e.preventDefault();
                break;
            case "Enter":
                if (focusedIndex === shownAmount) {
                    handleShowMore();
                    break;
                }

                const item = filteredData[focusedIndex];
                if (item) {
                    onSelect(item);
                }

                break;
            case "Escape":
                handleClose();
                break;
            default:
                break;
        }
    };

    const handleMouseEnter = useCallback((index: number) => {
        navigationSourceRef.current = "mouse";
        setFocusedIndex(index);
    }, []);

    const memoizedMouseEnterHandlers = useMemo(
        () =>
            filteredData.map((_, index) => () => {
                handleMouseEnter(index);
            }),
        [filteredData, handleMouseEnter],
    );

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const search = e.target.value;

        if (limit) {
            setShownAmount(limit);
        }

        if (filter) {
            setFilteredData(filter(search));
        } else {
            setFilteredData(data.filter((item) => getLabel(item).toLowerCase().includes(search.toLowerCase())));
        }

        setFocusedIndex(0);
    };

    const scrollToListEnd = () => {
        // if (listEndRef.current) {
        //     listEndRef.current.scrollIntoView({ behavior: "smooth" });
        // }
    };

    const handleShowMore = () => {
        if (!limit) return;
        const newShownAmount = Math.min(shownAmount + limit, filteredData.length);
        setShownAmount(newShownAmount);
        setFocusedIndex(newShownAmount);
        const timeoutId = setTimeout(scrollToListEnd, 0); // Ensure the new items are rendered before scrolling
        return () => clearTimeout(timeoutId);
    };

    const handleClick = useCallback(
        (index: number) => {
            const item = filteredData[index];
            if (item) {
                onSelect(item);
            }
        },
        [filteredData, onSelect],
    );

    const memoizedHandleClicks = useMemo(
        () =>
            filteredData.map((_, index) => () => {
                handleClick(index);
            }),
        [filteredData, handleClick],
    );

    return (
        <div ref={componentRef}>
            <div className="relative w-full">
                <input
                    ref={inputRef}
                    placeholder={placeholder}
                    disabled={disabled}
                    type="text"
                    className={cn(
                        "h-9 w-full rounded-md border border-neutral-400 px-3 focus:border-neutral-600 focus:outline-none disabled:bg-neutral-200",
                        open && "rounded-b-none",
                    )}
                    onKeyDown={handleKeyDown}
                    onChange={handleChange}
                    onFocus={() => setOpen(true)}
                />
                {open && (
                    <button
                        onClick={handleClose}
                        className="absolute right-0 top-0 h-9 -translate-y-0.5 px-3 text-lg text-neutral-700 hover:text-black hover:underline"
                    >
                        x
                    </button>
                )}
            </div>

            {open && ( // TODO: Position as overlay in smaller screens
                <div
                    ref={listRef}
                    className="max-h-96 w-full overflow-y-auto rounded-b-md border border-t-0 border-neutral-400 bg-white"
                >
                    {filteredData.slice(0, shownAmount).map((item, index) => (
                        <MemoizedSearchItem
                            key={index}
                            label={getLabel(item)}
                            isSelected={focusedIndex === index}
                            onMouseEnter={memoizedMouseEnterHandlers[index]}
                            onClick={memoizedHandleClicks[index]}
                            dataIndex={index}
                        />
                    ))}

                    {filteredData.length === 0 && <SearchEmptyItem />}

                    {displayShowMore && (
                        <MemoizedSearchShowMore
                            onClick={handleShowMore}
                            isSelected={focusedIndex === shownAmount}
                            onMouseEnter={memoizedMouseEnterHandlers[shownAmount]}
                            dataIndex={shownAmount}
                        />
                    )}

                    <div ref={listEndRef} />
                </div>
            )}
        </div>
    );
}

const MemoizedSearchItem = memo(function SearchItem({
    label,
    isSelected,
    onMouseEnter,
    onClick,
    dataIndex,
}: {
    label: string;
    isSelected: boolean;
    onMouseEnter?: () => void;
    onClick?: () => void;
    dataIndex: number;
}) {
    return (
        <div
            className={cn("flex h-8 cursor-pointer items-center px-3", isSelected && "bg-neutral-200")}
            onMouseEnter={onMouseEnter}
            onClick={onClick}
            data-index={dataIndex}
        >
            <p className="overflow-hidden text-ellipsis whitespace-nowrap">{label}</p>
        </div>
    );
});

function SearchEmptyItem() {
    return (
        <div className="flex h-8 cursor-pointer items-center px-3 data-[selected='true']:bg-neutral-200">
            <p className="text-center text-neutral-400">Sem resultados</p>
        </div>
    );
}

const MemoizedSearchShowMore = memo(function SearchShowMore({
    isSelected,
    onClick,
    onMouseEnter,
    dataIndex,
}: {
    isSelected?: boolean;
    onClick?: () => void;
    onMouseEnter?: () => void;
    dataIndex: number;
}) {
    const openPopover = usePlanoStore((state) => state.openPopover); // Access the openPopover action

    return (
        <>
            <button
                className={`h-8 w-full cursor-pointer px-3 text-center text-blue-600 hover:underline ${isSelected ? "bg-neutral-200" : ""}`}
                onClick={onClick}
                onMouseEnter={onMouseEnter}
                data-index={dataIndex}
            >
                Carregar mais... {isSelected ? "👇" : ""}
            </button>
            <button
                className={`h-8 w-full cursor-pointer px-3 text-center text-blue-600 hover:underline ${isSelected ? "bg-neutral-200" : ""}`}
                onClick={openPopover} // Open the Popover when clicked
                onMouseEnter={onMouseEnter}
            >
                Adicionar compromisso
            </button>
        </>
    );
});
