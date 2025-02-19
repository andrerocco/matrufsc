import { create } from "zustand";
import { MateriaExistsError, MateriaNotFoundError } from "./errors";
import { getCombinacoes, Plano } from "~/lib/combinacoes";

export interface Aula {
    dia_semana: number; // 1 = domingo, 2 = segunda, ..., 7 = sábado
    horarios: number[]; // Indexes of HORAS array
    sala: string;
}

export interface Turma {
    id: string;
    carga_horaria: number;
    aulas: Aula[];
    professores: string[];
    selected: boolean;
}

export interface Materia {
    id: string;
    nome: string;
    turmas: Turma[];
    cor?: string;
    selected: boolean;
    // TODO: Add 'blocked'/'disabled' for when it collides with another materia that is higher on the list
}

// type Plano = Materia[];

type PlanoState = {
    materias: Materia[];
    planos: Plano[]; // Materia[][]

    selectedPlanoIndex: number; // TODO: Private? Does not need to be exposed to components
    nextMateriaColorIndex: number; // TODO: Private? Does not need to be exposed to components

    addMateria: (materia: Materia) => MateriaExistsError | null;
    removeMateria: (id: string) => MateriaNotFoundError | null;
    updateSelected: (id: string, selected: boolean) => void;

    // plano: Plano;

    // updateMateria: (id: string, data: Partial<Materia>) => void;
    // resetPlano: (newPlano: Plano) => void;
};

const COLORS = [
    "lightblue",
    "lightcoral",
    "lightcyan",
    "lightgoldenrodyellow",
    "lightgray",
    "lightgreen",
    "lightpink",
    "lightsalmon",
    "lightseagreen",
    "lightskyblue",
    "lightslategray",
    "lightslategrey",
    "lightsteelblue",
    "lightyellow",
];

export const usePlanoStore = create<PlanoState>((set, get) => ({
    selectedPlanoIndex: 0,
    nextMateriaColorIndex: 0,

    materias: [],

    planos: [],

    addMateria: (materia) => {
        const { materias, nextMateriaColorIndex } = get();

        const exists = materias.some((m) => m.id === materia.id);
        if (exists) return new MateriaExistsError();

        const color = COLORS[nextMateriaColorIndex];
        const updatedMaterias = [...materias, { ...materia, cor: color }];

        // Generate planos
        let combinacoes = getCombinacoes(updatedMaterias);
        console.log(combinacoes);
        // if empty, disable last (newly added) materia and recalculate
        if (combinacoes.length === 0 && updatedMaterias.length > 0) {
            updatedMaterias[updatedMaterias.length - 1].selected = false;
            console.log(">>>>", updatedMaterias);
            console.log(">>>>", combinacoes);
            combinacoes = getCombinacoes(updatedMaterias);
        }

        set(() => ({
            planos: combinacoes,
            materias: updatedMaterias,
            nextMateriaColorIndex: (nextMateriaColorIndex + 1) % COLORS.length,
        }));

        return null;
    },

    removeMateria: (id) => {
        const { materias } = get();

        const exists = materias.some((m) => m.id === id);
        if (!exists) return new MateriaNotFoundError();

        const updatedMaterias = materias.filter((materia) => materia.id !== id);

        // Regenerate planos
        const combinacoes = getCombinacoes(updatedMaterias);
        console.log(combinacoes);

        set(() => ({
            planos: combinacoes,
            materias: updatedMaterias,
        }));

        return null;
    },

    updateSelected: (id, selected) => {
        set((state) => {
            const materia = state.materias.find((m) => m.id === id);
            if (materia) materia.selected = selected; // Modify directly
            return { materias: state.materias }; // Keep the same array reference
        });
    },
}));
