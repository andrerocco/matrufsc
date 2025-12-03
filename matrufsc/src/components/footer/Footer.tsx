import clsx from "clsx";

export default function Footer(props: { class?: string }) {
    return (
        <footer class={clsx("flex items-center justify-between", props.class)}>
            <p>
                Não se esqueça de fazer sua matrícula no{" "}
                <a class="text-nowrap" target="_blank" href="http://cagr.ufsc.br/" rel="noreferrer">
                    CAGR
                </a>
                ! Este aplicativo não tem nenhum vínculo com a UFSC.
                <br />
                <a class="text-nowrap" href="https://github.com/caravelahc/capim">
                    https://github.com/caravelahc/capim
                </a>
            </p>

            <div class="flex gap-4">
                <a class="text-nowrap" target="_blank" href="https://github.com/caravelahc/capim/wiki" rel="noreferrer">
                    Como usar
                </a>
                <a target="_blank" href="https://github.com/caravelahc/capim#readme" rel="noreferrer">
                    Sobre
                </a>
            </div>
        </footer>
    );
}
