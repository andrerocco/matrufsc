import { For } from "solid-js";
import { ANNOUNCEMENTS, formatDate } from "~/components/announcements/items";
import IllustrationFrame from "~/components/announcements/IllustrationFrame";
import { appLink } from "~/lib/appLink";

export default function Changelog() {
    const newestFirst = [...ANNOUNCEMENTS].sort((a, b) => b.date.localeCompare(a.date));

    return (
        <main class="mx-auto flex min-h-dvh max-w-[1000px] flex-col gap-10 px-6 py-8">
            <h1 class="text-2xl!">
                <a href={appLink()}>MatrUFSC</a> / Novidades
            </h1>

            <div class="divide-y divide-neutral-300">
                <For each={newestFirst}>
                    {(announcement) => (
                        <article
                            id={announcement.id}
                            class="flex flex-col gap-3 py-8 first:pt-0 lg:grid lg:grid-cols-[1fr_36rem_1fr] lg:gap-10"
                        >
                            <p class="mx-auto w-full max-w-144 text-xs tracking-wider text-neutral-500 uppercase lg:pt-1">
                                {formatDate(announcement.date)}
                            </p>
                            <div class="mx-auto flex w-full max-w-144 flex-col gap-3">
                                <h2 class="mb-2 text-2xl! lg:mb-2.5">{announcement.title}</h2>
                                <IllustrationFrame
                                    announcement={announcement}
                                    class="mb-1 aspect-video rounded-md border border-neutral-400"
                                />
                                {announcement.details()}
                            </div>
                        </article>
                    )}
                </For>
            </div>
        </main>
    );
}
