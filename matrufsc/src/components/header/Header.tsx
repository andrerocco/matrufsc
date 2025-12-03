import clsx from "clsx";
import { For } from "solid-js";

export default function Header(props: {
    campusOptions: { title: string; value: string }[];
    campusValue: string;
    onCampusChange: (value: string) => void;
    semesterOptions: { title: string; value: string }[];
    semesterValue: string;
    onSemesterChange: (value: string) => void;
    class?: string;
}) {
    return (
        <header class={clsx(props.class)}>
            <div class="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <h1 class="mr-3">MatrUFSC</h1>
                <div class="flex gap-4">
                    <select
                        name="campus"
                        id="campus"
                        class="bg-transparent focus:border-transparent focus:outline-none"
                        value={props.campusValue}
                        onChange={(e) => props.onCampusChange(e.currentTarget.value)}
                    >
                        <For each={props.campusOptions}>
                            {(campus) => <option value={campus.value}>{campus.title}</option>}
                        </For>
                    </select>
                    <select
                        name="semester"
                        id="semester"
                        class="bg-transparent focus:border-transparent focus:outline-none"
                        value={props.semesterValue}
                        onChange={(e) => props.onSemesterChange(e.currentTarget.value)}
                    >
                        <For each={props.semesterOptions}>
                            {(semester) => <option value={semester.value}>{semester.title}</option>}
                        </For>
                    </select>
                </div>
            </div>
        </header>
    );
}
