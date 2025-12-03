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

    function updatePlano(input: string) {
        const value = Number(input);
        const newIndex = Math.max(0, Math.min(value - 1, totalPlanos() - 1));
        setPlanoIndex(newIndex);
        setInputValue(String(newIndex + 1));
    }

    function handleKeyDown(event: KeyboardEvent) {
        if (planosEmpty()) return;

        if (event.key === "ArrowUp") {
            event.preventDefault();
            handleIncrement();
        } else if (event.key === "ArrowDown") {
            event.preventDefault();
            handleDecrement();
        } else if (event.key === "Enter") {
            updatePlano((event.target as HTMLInputElement).value);
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
                class="hide-spin-button h-6 w-12 rounded-md border border-neutral-400 bg-white px-1 text-right disabled:opacity-50"
                type="number"
                min={1}
                max={totalPlanos()}
                disabled={planosEmpty()}
                value={inputValue()}
                onInput={(e) => setInputValue(e.currentTarget.value)}
                onBlur={() => updatePlano(inputValue())}
                onKeyDown={handleKeyDown}
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
