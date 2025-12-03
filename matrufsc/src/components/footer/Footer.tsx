export default function Footer() {
    return (
        <footer class="mt-8 flex items-center justify-between">
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
