import clsx from "clsx";

export default function Footer(props: { class?: string }) {
    return (
        <footer class={clsx("flex items-center justify-between", props.class)}>
            <p>
                <span>Este aplicativo não possui vínculo oficial com a UFSC.</span>
                <br />
                <span>
                    Não se esqueça de fazer sua matrícula no{" "}
                    <a class="text-nowrap" target="_blank" href="http://cagr.ufsc.br/" rel="noreferrer">
                        CAGR
                    </a>
                    !
                </span>
            </p>

            <div class="flex gap-7">
                <a target="_blank" href="#" rel="noreferrer">
                    Sobre
                </a>
            </div>
        </footer>
    );
}
