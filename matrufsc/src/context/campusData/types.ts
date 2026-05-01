export type JSONTurma = [
    string, // Código da turma
    number, // Carga horária
    number, // Vagas ofertadas
    number, // Vagas ocupadas
    number, // Vagas reservadas
    number, // Vagas disponíveis
    number, // Vagas excedentes
    string[], // Locais e horários
    string[], // Professores
];

export type JSONDisciplina = [
    string, // Código
    string, // Nome completo
    string, // Nome
    JSONTurma[], // Turmas
];

export type JSONCampusCode = "FLO" | "JOI" | "CBS" | "ARA" | "BLN";

export interface JSONCampus {
    campus: JSONCampusCode;
    data_extracao: string;
    disciplinas: JSONDisciplina[];
}
