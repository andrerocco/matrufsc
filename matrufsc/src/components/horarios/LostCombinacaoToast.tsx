import { Show } from "solid-js";
import X from "lucide-solid/icons/x";
import { useUrlState } from "~/context/url/UrlState";
import Toast from "~/components/toast/Toast";

export default function LostCombinacaoToast() {
    const { combinacaoLost, dismissCombinacaoLost } = useUrlState();

    return (
        <Show when={combinacaoLost()}>
            <Toast>
                <span class="py-2">Os horários mudaram: a combinação deste link não existe mais.</span>
                <button
                    class="flex h-[44px] cursor-pointer items-center px-4"
                    aria-label="Fechar"
                    onClick={dismissCombinacaoLost}
                >
                    <X size="1.25em" strokeWidth={1.75} aria-hidden="true" />
                </button>
            </Toast>
        </Show>
    );
}
