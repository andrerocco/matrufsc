export interface Aula {
    dia_semana: number; // 1 = domingo, 2 = segunda, ..., 7 = sábado
    horarios: number[]; // Indexes of HORAS array
    sala: string;
}

export interface Curso {
    id: number;
    nome: string;
}

export interface Turma {
    id: string;
    carga_horaria: number;
    vagas_ofertadas: number;
    vagas_ocupadas: number;
    aulas: Aula[];
    professores: string[];
    curso: Curso;
    status: string | null;
    selected: boolean;
}

export interface Materia {
    id: string;
    nome: string;
    campus: string;
    semester: string;
    turmas: Turma[];
    cor?: string;
    selected: boolean;
    blocked?: boolean;
}
