import clsx from "clsx";

export default function Footer(props: { class?: string }) {
    return (
        <footer class={clsx("flex items-center justify-between", props.class)}>
            <p>
                Não se esqueça de fazer sua matrícula no{" "}
                <a class="text-nowrap" target="_blank" href="http://cagr.ufsc.br/" rel="noreferrer">
                    CAGR
                </a>
                !
                <br />
                Este aplicativo não tem nenhum vínculo com a UFSC.
            </p>

            <div class="flex gap-4">
                <a target="_blank" href="#" rel="noreferrer">
                    Sobre
                </a>
            </div>
        </footer>
    );
}
