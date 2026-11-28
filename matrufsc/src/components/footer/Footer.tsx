import clsx from "clsx";

export default function Footer(props: { class?: string }) {
    return (
        <footer
            class={clsx(
                "flex justify-between max-sm:flex-col max-sm:gap-4 max-sm:text-center sm:items-center",
                props.class,
            )}
        >
            <p class="hyphens-auto">
                <span>Este aplicativo não possui vínculo oficial com a UFSC.</span> <br class="max-sm:hidden" />
                <span>
                    Não se esqueça de fazer sua matrícula no{" "}
                    <a class="text-nowrap" target="_blank" href="http://cagr.ufsc.br/" rel="noreferrer">
                        CAGR
                    </a>
                    !
                </span>
            </p>

            <div class="flex gap-7 max-sm:justify-center">
                <a
                    href="https://docs.google.com/forms/d/e/1FAIpQLSdJUFYTgDtF4iT-4-zBEEpW1HiAJ5ipaUl6rr67H6-KQFoKXw/viewform"
                    target="_blank"
                    rel="noreferrer"
                >
                    Avaliar
                </a>
                <a href={`${import.meta.env.BASE_URL}sobre`}>Sobre</a>
            </div>
        </footer>
    );
}
