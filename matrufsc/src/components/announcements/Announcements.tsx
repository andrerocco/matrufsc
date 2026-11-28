import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { makePersisted, storageSync } from "@solid-primitives/storage";
import { ANNOUNCEMENTS, type Announcement } from "./items";
import AnnouncementDialog from "./AnnouncementDialog";
import IllustrationFrame from "./IllustrationFrame";

const DURATION = 60 * 60 * 1000;

export default function Announcements() {
    // When each announcement stops showing: `DURATION` after it first appeared, or when it was dismissed.
    // Without `storageSync`, a tab opened earlier would write the list back without what another tab changed.
    const [endsAt, setEndsAt] = makePersisted(createSignal<Record<string, number>>({}), {
        name: "matrufsc:announcements:endsAt",
        sync: storageSync,
    });
    const [expired, expire] = createSignal(undefined, { equals: false });
    const current = () => {
        expired();
        return ANNOUNCEMENTS.find((announcement) => endsAt()[announcement.id] > Date.now());
    };

    const startNext = () => {
        const next = ANNOUNCEMENTS.find((announcement) => !(announcement.id in endsAt()));
        const lastEnd = Math.max(0, ...Object.values(endsAt()));
        const today = new Date().setHours(0, 0, 0, 0);
        if (next && lastEnd < today) setEndsAt({ ...endsAt(), [next.id]: Date.now() + DURATION });
    };
    // On touch devices (where the card is hidden) and in background tabs, the time would run out unseen.
    if (!matchMedia("(pointer: coarse)").matches) {
        if (document.visibilityState === "visible") startNext();
        else document.addEventListener("visibilitychange", startNext, { once: true });
    }

    createEffect(() => {
        const announcement = current();
        if (!announcement) return;
        const timeout = setTimeout(expire, endsAt()[announcement.id] - Date.now());
        onCleanup(() => clearTimeout(timeout));
    });

    const [opened, setOpened] = createSignal<Announcement>();
    const dismiss = (announcement: Announcement) =>
        setEndsAt((endsAt) => ({ ...endsAt, [announcement.id]: Date.now() }));

    return (
        <>
            <Show when={opened()} keyed>
                {(announcement) => (
                    <AnnouncementDialog announcement={announcement} onClose={() => setOpened(undefined)} />
                )}
            </Show>
            <Show when={current()} keyed>
                {(announcement) => (
                    <aside
                        aria-label="Novidade"
                        class="group fixed bottom-6 z-30 w-72 overflow-hidden rounded-md border border-neutral-400 bg-white pointer-coarse:hidden"
                        // `right` is measured from the space `scrollbar-gutter` reserves for the scrollbar.
                        style={{
                            right: `calc(1.5rem - ${window.innerWidth - document.documentElement.offsetWidth}px)`,
                        }}
                    >
                        <button
                            type="button"
                            class="block w-full cursor-pointer text-left"
                            onClick={() => {
                                setOpened(announcement);
                                dismiss(announcement);
                            }}
                        >
                            <IllustrationFrame
                                announcement={announcement}
                                class="aspect-video border-b border-neutral-400"
                            />
                            <div class="px-3 py-2.75 pt-3">
                                <p class="mb-1.5 text-xs tracking-wider text-neutral-500">Novo no MatrUFSC:</p>
                                <p class="text-[12px] leading-normal">{announcement.text()}</p>
                            </div>
                        </button>
                        <button
                            type="button"
                            aria-label="Fechar"
                            class="hit-area-2 absolute top-2.5 right-2.5 cursor-pointer text-neutral-700 group-hover:opacity-100 hover:text-black focus-visible:opacity-100 [@media(hover:hover)]:opacity-0"
                            onClick={() => dismiss(announcement)}
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
                    </aside>
                )}
            </Show>
        </>
    );
}
