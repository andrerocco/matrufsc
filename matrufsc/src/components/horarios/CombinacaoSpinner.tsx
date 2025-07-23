import { usePlanoStore } from "~/providers/plano/store";
import { KeyboardEvent, useEffect, useState } from "react";

export default function CombinacaoSpinner() {
    const currentPlanoIndex = usePlanoStore((state) => state.currentPlanoIndex);
    const setPlanoIndex = usePlanoStore((state) => state.setPlanoIndex);
    const totalPlanos = usePlanoStore((state) => state.planos.length);
    const planosEmpty = usePlanoStore((state) => state.planos.length === 0 || state.planos[0].length === 0);

    const [inputValue, setInputValue] = useState<string | undefined>("");

    useEffect(() => {
        setInputValue(planosEmpty ? "" : String(currentPlanoIndex + 1));
    }, [totalPlanos]);

    const handlePrevious = () => {
        if (planosEmpty) return;
        const newIndex = (currentPlanoIndex - 1 + totalPlanos) % totalPlanos;
        setPlanoIndex(newIndex);
        setInputValue(String(newIndex + 1));
    };

    const handleNext = () => {
        if (planosEmpty) return;
        const newIndex = (currentPlanoIndex + 1) % totalPlanos;
        setPlanoIndex(newIndex);
        setInputValue(String(newIndex + 1));
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (planosEmpty) return;

        switch (event.key) {
            case "ArrowUp": {
                event.preventDefault();
                handleNext();
                break;
            }
            case "ArrowDown": {
                event.preventDefault();
                handlePrevious();
                break;
            }
            case "Enter": {
                const input = event.target as HTMLInputElement;
                const value = Number(input.value);
                const newIndex = Math.max(0, Math.min(value - 1, totalPlanos - 1));
                setPlanoIndex(newIndex);
                setInputValue(String(newIndex + 1));
                break;
            }
        }
    };

    return (
        <div className="flex gap-2">
            <button
                className="flex size-6 items-center justify-center rounded-md border border-neutral-400 bg-white pb-px disabled:opacity-50"
                onClick={handlePrevious}
                disabled={planosEmpty}
            >
                {"<"}
            </button>
            <input
                // ref={inputRef}
                value={inputValue}
                onInput={(e) => setInputValue(e.currentTarget.value)}
                onKeyDown={handleKeyDown}
                type="number"
                className="hide-spin-button h-6 w-12 rounded-md border border-neutral-400 bg-white px-1 text-right disabled:opacity-50"
                min={1}
                max={totalPlanos}
                disabled={planosEmpty}
            />
            <span>/ {totalPlanos}</span>
            <button
                className="flex size-6 items-center justify-center rounded-md border border-neutral-400 bg-white pb-px disabled:opacity-50"
                onClick={handleNext}
                disabled={planosEmpty}
            >
                {">"}
            </button>
            <span>combinações</span>
        </div>
    );
}
