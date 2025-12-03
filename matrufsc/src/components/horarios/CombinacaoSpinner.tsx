import { createEffect, createSignal } from "solid-js";
import { usePlano } from "~/context/plano/Plano.store";

export default function CombinacaoSpinner() {
    const { planos, currentPlanoIndex, setPlanoIndex } = usePlano();
    const totalPlanos = () => planos.length;
    const planosEmpty = () => planos.length === 0 || planos[0].length === 0;

    const [inputValue, setInputValue] = createSignal<string>("");

    createEffect(() => {
        setInputValue(planosEmpty() ? "" : String(currentPlanoIndex() + 1));
    });

    function handleIncrement() {
        if (planosEmpty()) return;
        setPlanoIndex((current) => (current + 1) % totalPlanos());
    }

    function handleDecrement() {
        if (planosEmpty()) return;
        setPlanoIndex((current) => (current - 1 + totalPlanos()) % totalPlanos());
    }

    function handleKeyDown(event: KeyboardEvent) {
        if (planosEmpty()) return;

        switch (event.key) {
            case "ArrowUp": {
                event.preventDefault();
                handleIncrement();
                break;
            }
            case "ArrowDown": {
                event.preventDefault();
                handleDecrement();
                break;
            }
            case "Enter": {
                const input = event.target as HTMLInputElement;
                const value = Number(input.value);
                const newIndex = Math.max(0, Math.min(value - 1, totalPlanos() - 1));
                setPlanoIndex(newIndex);
                break;
            }
        }
    }

    return (
        <div class="flex gap-2">
            <button
                class="flex size-6 cursor-pointer items-center justify-center rounded-md border border-neutral-400 bg-white pb-px disabled:opacity-50"
                onClick={handleDecrement}
                disabled={planosEmpty()}
            >
                {"<"}
            </button>
            <input
                value={inputValue()}
                onInput={(e) => setInputValue(e.currentTarget.value)}
                onKeyDown={handleKeyDown}
                type="number"
                class="hide-spin-button h-6 w-12 rounded-md border border-neutral-400 bg-white px-1 text-right disabled:opacity-50"
                min={1}
                max={totalPlanos()}
                disabled={planosEmpty()}
            />
            <span>/ {totalPlanos()}</span>
            <button
                class="flex size-6 cursor-pointer items-center justify-center rounded-md border border-neutral-400 bg-white pb-px disabled:opacity-50"
                onClick={handleIncrement}
                disabled={planosEmpty()}
            >
                {">"}
            </button>
            <span>combinações</span>
        </div>
    );
}
