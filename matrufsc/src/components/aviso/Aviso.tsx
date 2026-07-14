import { createSignal, onCleanup, Show } from "solid-js";

const AVISO_ID = "professores-turmas-equivalentes";
const CHAVE_FECHAMENTOS = `matrufsc:aviso:fechamentos:${AVISO_ID}`;
const CHAVE_PISCA = `matrufsc:aviso:pisca:${AVISO_ID}`;
const LIMITE_FECHAMENTOS = 3;

const lerFechamentos = (): number => {
    try {
        const valor = Number(localStorage.getItem(CHAVE_FECHAMENTOS));
        return Number.isFinite(valor) && valor > 0 ? valor : 0;
    } catch {
        return 0;
    }
};

/**
 * Relê o contador do localStorage na hora de gravar, em vez de usar o valor em memória: com várias
 * abas abertas, cada uma carregou o contador no seu próprio load, e incrementar em cima desse valor
 * velho faria a última aba a fechar sobrescrever os fechamentos das outras.
 */
function registrarFechamento(): number {
    const total = lerFechamentos() + 1;
    try {
        localStorage.setItem(CHAVE_FECHAMENTOS, String(total));
    } catch {
        // Navegação privada / storage bloqueado: o aviso segue funcionando, só não acumula.
    }
    return total;
}

// Fechar esconde o aviso só nesta aba; ele volta no próximo carregamento — até o usuário ter
// fechado LIMITE_FECHAMENTOS vezes, quando não aparece mais.
const [dismissed, setDismissed] = createSignal(false);
const [fechamentos, setFechamentos] = createSignal(lerFechamentos());

export const avisoVisible = () => !dismissed() && fechamentos() < LIMITE_FECHAMENTOS;

function fecharAviso() {
    setFechamentos(registrarFechamento());
    setDismissed(true);
}

// Se outra aba atingir o limite, esta aba para de mostrar o aviso também (o evento `storage` só
// dispara nas *outras* abas, nunca na que escreveu).
if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
        if (event.key === CHAVE_FECHAMENTOS) setFechamentos(lerFechamentos());
    });
}

// O pisca é uma chamada de atenção: roda uma vez por aba. Fica no sessionStorage (e não no
// localStorage) porque ele é por aba e some quando ela fecha — recarregar a mesma aba não pisca de
// novo, mas uma aba nova pisca.
function consomePisca(): boolean {
    try {
        if (sessionStorage.getItem(CHAVE_PISCA)) return false;
        sessionStorage.setItem(CHAVE_PISCA, "1");
        return true;
    } catch {
        return false; // navegação privada / storage bloqueado: melhor não piscar do que quebrar
    }
}

// Momento em que a correção foi ao ar (horário de Brasília).
const CORRECAO = new Date("2026-07-14T12:20:00-03:00");

const inicioDoDia = (data: Date) => new Date(data.getFullYear(), data.getMonth(), data.getDate());

const horaDaCorrecao = () => CORRECAO.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Sempre a data absoluta: "12:20 de 14/07". */
const dataDaCorrecao = () =>
    `${CORRECAO.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${horaDaCorrecao()}`;

/** "12:20 de hoje", "12:20 de ontem" ou, mais para frente, a data absoluta. */
function momentoDaCorrecao(agora = new Date()): string {
    const diasAtras = Math.round(
        (inicioDoDia(agora).getTime() - inicioDoDia(CORRECAO).getTime()) / (24 * 60 * 60 * 1000),
    );

    if (diasAtras === 0) return `${horaDaCorrecao()} de hoje`;
    if (diasAtras === 1) return `${horaDaCorrecao()} de ontem`;
    return dataDaCorrecao();
}

// A barra é `fixed`, então não ocupa espaço no fluxo. O App usa esta altura para reservar o espaço
// dela e não deixar o rodapé ficar embaixo. Medida em vez de chutada: a altura muda com o tamanho da
// tela e com qualquer mexida no texto do aviso.
const [avisoAltura, setAvisoAltura] = createSignal(0);
export { avisoAltura };

function observarAltura(el: HTMLElement) {
    const observer = new ResizeObserver(() => setAvisoAltura(el.offsetHeight));
    observer.observe(el);
    setAvisoAltura(el.offsetHeight);
    onCleanup(() => observer.disconnect());
}

export default function Aviso() {
    const correcao = momentoDaCorrecao();
    const pisca = consomePisca();

    return (
        <Show when={avisoVisible()}>
            <div
                ref={observarAltura}
                classList={{ "aviso-pisca": pisca }}
                class="not-prose fixed inset-x-0 bottom-0 z-50 max-h-[70vh] overflow-y-auto border-t border-neutral-400 bg-white"
            >
                <div class="mx-auto flex w-full max-w-[1000px] items-start gap-4 px-6 py-2 sm:gap-6">
                    <div class="min-w-0 flex-1">
                        <p>
                            <b class="text-red-600">IMPORTANTE:</b> Se fez sua matrícula antes de {correcao}, verifique
                            o código das turmas escolhidas novamente.
                        </p>

                        <div class="mt-3 mb-1 flex flex-col gap-2">
                            <p>
                                O MatrUFSC estava mostrando a turma incorreta para alguns professores. Isso já foi
                                corrigido. Se você deixou o MatrUFSC aberto em outra aba, recarregue-o para atualizar.
                            </p>
                            <p>
                                <b>
                                    Se fez sua matrícula antes de {dataDaCorrecao()}, confira se o código das turmas que
                                    você escolheu está de acordo com o MatrUFSC atualizado ou com a listagem de turmas no{" "}
                                    <a
                                        class="text-nowrap underline"
                                        href="https://cagr.sistemas.ufsc.br/modules/comunidade/cadastroTurmas/"
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        CAGR
                                    </a>
                                    .
                                </b>{" "}
                                Clique{" "}
                                <a
                                    href="https://github.com/matrufsc/matrufsc.github.io/blob/main/MATERIAS_AFETADAS.md"
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    aqui
                                </a>{" "}
                                para saber quais disciplinas mostravam códigos incorretos.
                            </p>
                            <p>
                                <i>Por favor, avise seus colegas.</i>
                            </p>
                        </div>
                    </div>

                    {/* No fluxo, à direita da mesma coluna de 1000px do resto do app, para o texto
                        continuar exatamente centralizado e não passar por baixo do botão. */}
                    <button
                        type="button"
                        aria-label="Fechar aviso"
                        onClick={fecharAviso}
                        class="hit-area-2 shrink-0 cursor-pointer text-lg text-blue-600 transition-colors duration-75 hover:text-blue-900 hover:underline"
                    >
                        x
                    </button>
                </div>
            </div>
        </Show>
    );
}
