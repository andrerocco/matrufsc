import { useState, KeyboardEvent, ChangeEvent, useMemo, memo, useCallback, useEffect, useRef } from "react";
import { cn } from "~/lib/utils";

export default function Search<T>({
    data,
    onSelect,
    getLabel,
    filter,
    placeholder,
    limit,
}: {
    data: T[];
    onSelect: (item: T) => void;
    getLabel: (item: T) => string; // Function to extract the string representation
    filter?: (search: string) => T[]; // Function to filter the items
    placeholder?: string;
    limit?: number;
}) {
    const [open, setOpen] = useState(false);
    const [shownAmount, setShownAmount] = useState(limit ?? data.length);
    const [focusedIndex, setFocusedIndex] = useState(0);
    const [filteredData, setFilteredData] = useState(data);

    const displayShowMore = filteredData.length > shownAmount;

    const getShowingAmount = () =>
        Math.min(shownAmount ?? filteredData.length, filteredData.length) + (displayShowMore ? 1 : 0);

    const handleClose = () => {
        // TODO: Clear search
        setOpen(false);
        setShownAmount(limit ?? data.length);
        setFocusedIndex(0);
        setFilteredData(data);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        switch (e.key) {
            case "ArrowUp":
                setFocusedIndex((prev) => (prev - 1 + getShowingAmount()) % getShowingAmount());
                e.preventDefault();
                break;
            case "ArrowDown":
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
    };

    const handleShowMore = useCallback(() => {
        if (!limit) return;
        setShownAmount((prev) => prev + limit);
    }, [limit]);

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
        <div>
            <div className="relative w-full">
                <input
                    placeholder={placeholder}
                    type="text"
                    className={cn(
                        "w-full rounded-md border border-neutral-400 px-3 py-1 focus:border-neutral-600 focus:outline-none",
                        open && "rounded-b-none",
                    )}
                    onKeyDown={handleKeyDown}
                    onChange={handleChange}
                    onFocus={() => setOpen(true)}
                />
                {open && (
                    <button
                        onClick={handleClose}
                        className="absolute right-0 top-0 px-3 py-1 text-lg text-neutral-700 hover:text-black hover:underline"
                    >
                        x
                    </button>
                )}
            </div>

            {open && (
                <div className="max-h-[50vh] w-full overflow-y-auto rounded-b-md border border-t-0 border-neutral-400 bg-white lg:max-h-[400px]">
                    {filteredData.slice(0, shownAmount).map((item, index) => (
                        <MemoizedSearchItem
                            key={index}
                            label={getLabel(item)}
                            isSelected={focusedIndex === index}
                            onMouseEnter={memoizedMouseEnterHandlers[index]}
                            onClick={memoizedHandleClicks[index]}
                        />
                    ))}

                    {filteredData.length === 0 && <SearchEmptyItem />}

                    {displayShowMore && (
                        <MemoizedSearchShowMore
                            onClick={handleShowMore}
                            isSelected={focusedIndex === shownAmount}
                            onMouseEnter={memoizedMouseEnterHandlers[shownAmount]}
                        />
                    )}
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
}: {
    label: string;
    isSelected: boolean;
    onMouseEnter?: () => void;
    onClick?: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isSelected && ref.current) ref.current.scrollIntoView({ block: "nearest" });
    }, [isSelected]); // TODO: Move to parent?

    return (
        <div
            ref={ref}
            className={`cursor-pointer px-3 py-1 ${isSelected ? "bg-neutral-200" : ""}`}
            onMouseEnter={onMouseEnter}
            onClick={onClick}
        >
            <p className="overflow-hidden text-ellipsis whitespace-nowrap">{label}</p>
        </div>
    );
});

function SearchEmptyItem() {
    return (
        <div className="cursor-pointer px-3 py-1 data-[selected='true']:bg-neutral-200">
            <p className="text-center text-neutral-400">Sem resultados</p>
        </div>
    );
}

const MemoizedSearchShowMore = memo(function SearchShowMore({
    isSelected,
    onClick,
    onMouseEnter,
}: {
    isSelected?: boolean;
    onClick?: () => void;
    onMouseEnter?: () => void;
}) {
    const ref = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (isSelected && ref.current) ref.current.scrollIntoView({ block: "nearest" });
    }, [isSelected]); // TODO: Move to parent?

    // useEffect(() => {
    //     if (ref.current) ref.current.scrollIntoView({ block: "nearest" });
    // }); // Scroll to element when it is rendered so it does not get hidden when new items are added and overflow-y is scroll

    return (
        <button
            ref={ref}
            className={`w-full cursor-pointer px-3 py-1 text-center text-blue-600 hover:underline ${isSelected ? "bg-neutral-200" : ""}`}
            onClick={onClick}
            onMouseEnter={onMouseEnter}
        >
            Carregar mais... {isSelected ? "👇" : ""}
        </button>
    );
});
