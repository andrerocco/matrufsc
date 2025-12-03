import { For } from "solid-js";

export default function Header(props: {
    campusOptions: { title: string; value: string }[];
    campusValue: string;
    onCampusChange: (value: string) => void;
    semesterOptions: { title: string; value: string }[];
    semesterValue: string;
    onSemesterChange: (value: string) => void;
}) {
    return (
        <header class="mb-8 flex items-center justify-between">
            <div class="flex items-center gap-3">
                <h1 class="mr-3">MatrUFSC</h1>
                <select
                    name="campus"
                    id="campus"
                    class="bg-transparent focus:border-transparent focus:outline-none"
                    value={props.campusValue}
                    onChange={(e) => props.onCampusChange(e.currentTarget.value)}
                >
                    <For each={props.campusOptions}>
                        {(campus) => (
                            <option value={campus.value}>
                                {campus.title}
                            </option>
                        )}
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
                        {(semester) => (
                            <option value={semester.value}>
                                {semester.title}
                            </option>
                        )}
                    </For>
                </select>
            </div>
        </header>
    );
}
