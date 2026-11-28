import { For } from "solid-js";
import type { Announcement } from ".";

const DIAS = ["Segunda", "Terça", "Quarta", "Quinta"];
const HORAS = ["07:30", "08:20", "09:10", "10:10"];
const AULAS: Record<string, { id: string; cor: string }> = {
    "08:20 Segunda": { id: "INE5401", cor: "lightcyan" },
    "09:10 Segunda": { id: "INE5401", cor: "lightcyan" },
    "07:30 Quarta": { id: "MTM3100", cor: "lightgoldenrodyellow" },
    "08:20 Quarta": { id: "MTM3100", cor: "lightgoldenrodyellow" },
};

const CURSOS = [
    "MEDICINA",
    "DIREITO",
    "PSICOLOGIA",
    "ODONTOLOGIA",
    "ADMINISTRAÇÃO",
    "JORNALISMO",
    "DESIGN",
    "CIÊNCIAS DA COMPUTAÇÃO",
    "SISTEMAS DE INFORMAÇÃO",
    "ENGENHARIA MECÂNICA",
    "ENGENHARIA CIVIL",
    "ENGENHARIA ELÉTRICA",
    "ARQUITETURA E URBANISMO",
    "RELAÇÕES INTERNACIONAIS",
    "CIÊNCIAS ECONÔMICAS",
];
const CURSO = CURSOS[Math.floor(Math.random() * CURSOS.length)];

export default {
    id: "search-filters",
    date: "2026-11-27",
    title: "Novidade: Filtros na busca",
    text: () => (
        <>
            Filtre a busca digitando <FilterKey>curso:</FilterKey>, <FilterKey>professor:</FilterKey> ou{" "}
            <FilterKey>departamento:</FilterKey>.
        </>
    ),
    details: () => (
        <>
            <p>
                Agora é possível filtrar a busca de disciplinas por curso, departamento ou professor dentro do MatrUFSC.
                Para isso, basta digitar <FilterKey>curso:</FilterKey>, <FilterKey>departamento:</FilterKey> ou{" "}
                <FilterKey>professor:</FilterKey> na busca e escolher uma opção da lista.
            </p>
            <p>Filtrar por curso mostra as disciplinas que têm pelo menos uma turma ofertada para aquele curso.</p>
        </>
    ),
    illustration: Illustration,
} satisfies Announcement;

function FilterKey(props: { children: string }) {
    return <span class="rounded bg-neutral-100 px-0.5">{props.children}</span>;
}

function Illustration() {
    // The scene was framed for a 22-letter name: other lengths zoom and slide along the field to stay centered.
    const spare = 22 - CURSO.length;

    return (
        <div
            class="absolute top-1/2 left-1/2 -mt-22 -ml-36 w-168 origin-[9rem_5.5rem] -translate-x-1.5 translate-y-0.5 rotate-x-60 -rotate-z-45 transform-3d"
            style={{ scale: 1 + spare * 0.02 }}
        >
            <div class="relative transform-3d" style={{ left: `${spare / 2}ch` }}>
                <div class="mb-8 flex items-center gap-4 opacity-9">
                    <p class="mr-3 text-4xl font-medium">MatrUFSC</p>
                    <select class="bg-transparent">
                        <option>Florianópolis</option>
                    </select>
                    <select class="bg-transparent">
                        <option>2027.1</option>
                    </select>
                </div>
                <p class="flex h-9 items-center rounded-md border border-neutral-400 bg-white px-3 transform-3d">
                    <span class="relative transform-3d">
                        <span class="absolute inset-0 text-neutral-300/82 blur-[1.8px]">
                            curso:<span class="rounded bg-neutral-100/40 px-0.5">{CURSO}</span>
                        </span>
                        <span class="inline-block translate-z-[8px]">
                            curso:<span class="rounded bg-blue-50 px-0.5 text-blue-600">{CURSO}</span>
                        </span>
                    </span>
                </p>
                <table class="mt-8 ml-10 table-fixed border-separate opacity-9">
                    <thead>
                        <tr>
                            <th class="pr-1">
                                <input type="checkbox" class="mx-auto w-4 align-middle" />
                            </th>
                            <For each={DIAS}>
                                {(dia) => (
                                    <th class="w-[80px] rounded-sm border border-neutral-400 bg-neutral-100 px-1 py-1.5 font-normal text-neutral-700">
                                        {dia}
                                    </th>
                                )}
                            </For>
                        </tr>
                    </thead>
                    <tbody>
                        <For each={HORAS}>
                            {(hora) => (
                                <tr>
                                    <td class="py-1.5 pr-2 tracking-tight whitespace-nowrap">{hora}</td>
                                    <For each={DIAS}>
                                        {(dia) => {
                                            const aula = AULAS[`${hora} ${dia}`];
                                            return (
                                                <td
                                                    class="h-[30px] rounded-sm border border-neutral-500/80 bg-white px-1 text-center leading-none"
                                                    style={{ "background-color": aula?.cor }}
                                                >
                                                    {aula?.id}
                                                </td>
                                            );
                                        }}
                                    </For>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
