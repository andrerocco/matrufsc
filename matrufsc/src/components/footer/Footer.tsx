export default function Footer() {
    return (
        <footer className="mt-8 flex items-center justify-between">
            <p>
                Não se esqueça de fazer sua matrícula no{" "}
                <a className="text-nowrap" target="_blank" href="http://cagr.ufsc.br/" rel="noreferrer">
                    CAGR
                </a>
                ! Este aplicativo não tem nenhum vínculo com a UFSC.
                <br />
                <a className="text-nowrap" href="https://github.com/caravelahc/capim">
                    https://github.com/caravelahc/capim
                </a>
            </p>

            <div className="flex gap-4">
                <a
                    className="text-nowrap"
                    target="_blank"
                    href="https://github.com/caravelahc/capim/wiki"
                    rel="noreferrer"
                    // TODO: Points to nowhere
                >
                    Como usar
                </a>
                <a
                    target="_blank"
                    href="https://github.com/caravelahc/capim#readme"
                    rel="noreferrer"
                    // TODO: Create a modal
                >
                    Sobre
                </a>
            </div>
        </footer>
    );
}
