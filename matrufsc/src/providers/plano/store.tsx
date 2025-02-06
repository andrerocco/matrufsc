import { create } from "zustand";
import { MateriaExistsError, MateriaNotFoundError } from "./errors";
import { getCombinacoes } from "~/lib/combinacoes";

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
    selected: boolean;
    cor?: string;
}

type Plano = Materia[];

type PlanoState = {
    materias: Materia[];
    planos: Plano[]; // Materia[][]

    selectedPlanoIndex: number; // TODO: Private? Does not need to be exposed to components
    nextMateriaColorIndex: number; // TODO: Private? Does not need to be exposed to components

    addMateria: (materia: Materia) => MateriaExistsError | null;
    removeMateria: (id: string) => MateriaNotFoundError | null;

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
        const combinacoes = getCombinacoes(updatedMaterias);
        console.log(combinacoes);

        set(() => ({
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
            materias: updatedMaterias,
        }));

        return null;
    },

    // addMateria: (materia) => {
    //     const { plano, nextColorIndex } = get();

    //     const exists = plano.materias.some((m) => m.id === materia.id);
    //     if (exists) return new MateriaExistsError();

    //     const color = COLORS[nextColorIndex];
    //     const updatedMateria = { ...materia, cor: color };

    //     set((state) => ({
    //         plano: { ...state.plano, materias: [...state.plano.materias, updatedMateria] },
    //         nextColorIndex: (nextColorIndex + 1) % COLORS.length,
    //     }));

    //     return null;
    // },

    // addMateria: (materia) => {
    //     const { plano, nextColorIndex } = get();

    //     const exists = plano.materias.some((m) => m.id === materia.id);
    //     if (exists) return new MateriaExistsError();

    //     const color = COLORS[nextColorIndex];
    //     const updatedMateria = { ...materia, cor: color };

    //     set((state) => ({
    //         plano: { ...state.plano, materias: [...state.plano.materias, updatedMateria] },
    //         nextColorIndex: (nextColorIndex + 1) % COLORS.length,
    //     }));

    //     return null;
    // },

    // updateMateria: (id, data) => {
    //     const { plano } = get();

    //     const existingMateria = plano.materias.find((m) => m.id === id);
    //     if (!existingMateria) return;

    //     const updatedMateria = { ...existingMateria, ...data };

    //     set((state) => ({
    //         plano: {
    //             ...state.plano,
    //             materias: state.plano.materias.map((materia) => (materia.id === id ? updatedMateria : materia)),
    //         },
    //     }));
    // },

    // removeMateria: (id) => {
    //     const { plano } = get();
    //     const exists = plano.materias.some((m) => m.id === id);
    //     if (!exists) return new MateriaNotFoundError();

    //     set((state) => ({
    //         plano: {
    //             ...state.plano,
    //             materias: state.plano.materias.filter((materia) => materia.id !== id),
    //         },
    //     }));

    //     return null;
    // },

    // resetPlano: (newPlano) => {
    //     set({
    //         plano: newPlano,
    //         nextColorIndex: 0,
    //     });
    // },
}));

export function usePlano() {
    return usePlanoStore((state) => state);
}
