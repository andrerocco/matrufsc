/// Eventos customizados do Google Analytics (GA4).

declare global {
    interface Window {
        gtag?: (command: "event", eventName: string, params?: Record<string, unknown>) => void;
    }
}

/**
 * O `gtag` é carregado por um script no index.html. Bloqueadores de anúncio impedem esse carregamento
 * para boa parte dos usuários, então `window.gtag` pode simplesmente não existir — medir nunca pode
 * quebrar a página, daí o encadeamento opcional.
 */
export function track(evento: string, params?: Record<string, unknown>): void {
    window.gtag?.("event", evento, params);
}
