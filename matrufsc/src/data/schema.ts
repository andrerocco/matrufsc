/// Formato dos JSONs publicados na branch `data`. Nada aqui importa de fora de `src/data`.

export type JSONCampusCode = "FLO" | "JOI" | "CBS" | "ARA" | "BLN";
const CAMPUS_CODES: JSONCampusCode[] = ["FLO", "JOI", "CBS", "ARA", "BLN"];
export const isCampusCode = (value: string): value is JSONCampusCode => CAMPUS_CODES.includes(value as JSONCampusCode);

export type JSONTurma = [
    string, // Código da turma
    number, // Carga horária
    number, // Vagas ofertadas
    number, // Vagas ocupadas
    number, // Alunos especiais
    number, // Saldo de vagas
    number, // Pedidos sem vaga
    string[], // Locais e horários
    string[], // Professores
    number, // Curso ofertante, chave em `cursos`
    string | null, // Status mostrado pelo CAGR entre colchetes
];

// Horários de início que uma aula "dia.HHMM-N / sala" pode citar, na ordem do dia.
export const HORAS = [
    "0730",
    "0820",
    "0910",
    "1010",
    "1100",
    "1330",
    "1420",
    "1510",
    "1620",
    "1710",
    "1830",
    "1920",
    "2020",
    "2110",
];

export type JSONDisciplina = [
    string, // Código
    string, // Nome
    JSONTurma[], // Turmas
];

export type JSONCursos = Record<string, string>;

export interface JSONCampus {
    campus: JSONCampusCode;
    data_extracao: string;
    cursos: JSONCursos;
    disciplinas: JSONDisciplina[];
}
