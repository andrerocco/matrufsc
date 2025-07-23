import { create } from "zustand";
import { MateriaExistsError, MateriaNotFoundError } from "./errors";
// import { combinacoes, Plano, findClosestCombination } from "~/lib/combinacoes";
import { combinacoes, findClosestCombination, Plano } from "~/lib/combinacoes";

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
    blocked?: boolean;
}

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
    "lightsteelblue",
    "lightyellow",
];

// Define the public state interface
interface PlanoState {
    planos: Plano[];

    // State
    materias: Materia[];
    currentPlano: Plano | null;
    currentPlanoIndex: number;

    // Actions
    addMateria: (materia: Materia) => MateriaExistsError | null;
    removeMateria: (id: string) => MateriaNotFoundError | null;
    updateMateriaSelection: (id: string, selected: boolean) => void;
    updateTurmaSelection: (materiaId: string, turmaId: string, selected: boolean) => void;
    nextPlano: () => void;
    previousPlano: () => void;
    setPlanoIndex: (index: number) => void;
}

export const usePlanoStore = create<PlanoState>((set, get) => {
    // Helper function to recalculate plans and update state
    const recalculatePlanos = (materias: Materia[]) => {
        const planos = combinacoes(materias);
        return {
            materias,
            planos,
            currentPlanoIndex: 0,
            currentPlano: planos.length > 0 ? planos[0] : null,
        };
    };

    let colorIndex = 0;

    return {
        // Initial state
        materias: [],
        planos: [],
        currentPlanoIndex: 0,
        currentPlano: null,
        totalPlanos: 0,

        addMateria: (materia) => {
            const { currentPlano, materias } = get();
            colorIndex = (colorIndex + 1) % COLORS.length;

            // Check if materia already exists
            const exists = materias.some((m) => m.id === materia.id);
            if (exists) return new MateriaExistsError();

            // Add materia with color
            const newMateria = {
                ...materia,
                cor: COLORS[colorIndex],
                blocked: false,
            };
            let updatedMaterias = [...materias, newMateria];

            // Generate plan combinations
            let planos = combinacoes(updatedMaterias);

            // Handle clash case: if no valid plans found, disable the new materia
            if (planos.length === 0 && updatedMaterias.length > 0) {
                // Mark the last added materia as blocked and not selected
                updatedMaterias = updatedMaterias.map((m, index) => {
                    if (index === updatedMaterias.length - 1) {
                        return { ...m, selected: false, blocked: true };
                    }
                    return m;
                });

                // Recalculate plans with disabled materia
                planos = combinacoes(updatedMaterias);
            }

            // Com o objetivo de evitar shifts de layout, calcula uma combinação que seja a mais próxima da antiga.
            // TODO: É um extra (não essencial), vale avaliar a performance/otimizações
            const closestIndex = findClosestCombination(currentPlano, planos);

            // Update state
            set({
                materias: updatedMaterias,
                planos,
                currentPlanoIndex: closestIndex,
                currentPlano: planos.length > 0 ? planos[closestIndex] : null,
            });

            return null;
        },

        removeMateria: (id) => {
            const { materias, currentPlano } = get();

            // Check if materia exists
            const materiaIndex = materias.findIndex((m) => m.id === id);
            if (materiaIndex === -1) return new MateriaNotFoundError();

            // Remove materia and recalculate plans
            const updatedMaterias = materias.filter((m) => m.id !== id);

            if (updatedMaterias.length === 0) {
                console.log("Empty");
                set({
                    materias: [],
                    planos: [],
                    currentPlanoIndex: 0,
                    currentPlano: null,
                });
                return null;
            }

            // Calculate new combinations
            const newPlanos = combinacoes(updatedMaterias);

            // Find the closest combination to the current one
            const closestIndex = findClosestCombination(currentPlano, newPlanos);

            set({
                materias: updatedMaterias,
                planos: newPlanos,
                currentPlanoIndex: closestIndex,
                currentPlano: newPlanos.length > 0 ? newPlanos[closestIndex] : null,
            });

            return null;
        },
        updateMateriaSelection: (id, selected) => {
            const { materias } = get();

            // Update selected state for the specific materia
            const updatedMaterias = materias.map((m) => (m.id === id ? { ...m, selected } : m));

            // If selecting a materia and none of its turmas are selected, select all turmas
            if (selected === true) {
                const materia = materias.find((m) => m.id === id);
                const noTurmasSelected = materia?.turmas.every((t) => !t.selected);
                console.log("No turmas selected:", noTurmasSelected);
                if (noTurmasSelected) {
                    console.log("No turmas selected, selecting all turmas");
                    const materiaToUpdate = updatedMaterias.find((m) => m.id === id);
                    if (materiaToUpdate) {
                        materiaToUpdate.turmas.forEach((t) => (t.selected = true));
                    }
                }
            }

            // Recalculate plans and update state
            set(recalculatePlanos(updatedMaterias));
        },

        updateTurmaSelection: (materiaId, turmaId, selected) => {
            const { materias } = get();

            const updatedMaterias = materias.map((materia) => {
                if (materia.id === materiaId) {
                    const updatedTurmas = materia.turmas.map((turma) =>
                        turma.id === turmaId ? { ...turma, selected } : turma,
                    );
                    return { ...materia, turmas: updatedTurmas };
                }
                return materia;
            });

            set(recalculatePlanos(updatedMaterias));
        },

        nextPlano: () => {
            const { planos, currentPlanoIndex } = get();

            if (planos.length === 0) return;

            const newIndex = (currentPlanoIndex + 1) % planos.length;
            set({
                currentPlanoIndex: newIndex,
                currentPlano: planos[newIndex],
            });
        },

        previousPlano: () => {
            const { planos, currentPlanoIndex } = get();

            if (planos.length === 0) return;

            const newIndex = (currentPlanoIndex - 1 + planos.length) % planos.length;
            set({
                currentPlanoIndex: newIndex,
                currentPlano: planos[newIndex],
            });
        },

        setPlanoIndex: (index) => {
            const { planos } = get();

            if (planos.length === 0) return;

            // Ensure index is within valid range
            const validIndex = Math.max(0, Math.min(index, planos.length - 1));
            set({
                currentPlanoIndex: validIndex,
                currentPlano: planos[validIndex],
            });
        },
    };
});
