import { onMount } from "solid-js";
import type { Announcement } from "./items";
import IllustrationFrame from "./IllustrationFrame";

export default function AnnouncementDialog(props: { announcement: Announcement; onClose: () => void }) {
    let dialog!: HTMLDialogElement;
    onMount(() => dialog.showModal());

    return (
        <dialog
            ref={dialog}
            class="m-auto w-144 max-w-[calc(100vw-3rem)] overflow-hidden rounded-md border border-neutral-400 bg-white backdrop:bg-black/40"
            onClose={props.onClose}
            onClick={(event) => event.target === dialog && dialog.close()}
        >
            <IllustrationFrame announcement={props.announcement} class="aspect-video border-b border-neutral-400" />
            <div class="px-7 pt-6 pb-7">
                <h2 class="mb-5 text-xl!">{props.announcement.title}</h2>
                <div class="flex flex-col gap-3">{props.announcement.details()}</div>
            </div>
            <button
                type="button"
                aria-label="Fechar"
                class="hit-area-2 absolute top-4 right-4 cursor-pointer text-neutral-700 hover:text-black"
                onClick={() => dialog.close()}
            >
                <svg
                    width="1.25em"
                    height="1.25em"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.75"
                    stroke-linecap="round"
                    aria-hidden="true"
                >
                    <path d="M18 6 6 18M6 6l12 12" />
                </svg>
            </button>
        </dialog>
    );
}
