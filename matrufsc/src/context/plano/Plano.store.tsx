import { createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { combinacoes, findClosestCombination, type Plano } from "~/lib/combinacoes";
import { MateriaExistsError, MateriaNotFoundError } from "./errors";
import { COLORS } from "./constants";

export interface Aula {
    dia_semana: number; // 1 = domingo, 2 = segunda, ..., 7 = sábado
    horarios: number[]; // Indexes of HORAS array
    sala: string;
    fixed?: boolean; // New property to indicate fixed classes
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
    blocked?: boolean; // New property to indicate clash status
}

const [materias, setMaterias] = createStore<Materia[]>([]);
const [planos, setPlanos] = createStore<Plano[]>([]); // Signal this? No granular updates anyway
const [currentPlanoIndex, setCurrentPlanoIndex] = createSignal(0);
const currentPlano = () => planos[currentPlanoIndex()] ?? null;

let colorIndex = 0;

function addMateria(materia: Materia): MateriaExistsError | null {
    const exists = materias.find((m) => m.id === materia.id); // Check if materia already exists
    if (exists) return new MateriaExistsError(`${materia.id} já adicionada ao plano`);

    colorIndex = (colorIndex + 1) % COLORS.length;

    // Add metadata to the new materia
    const newMateria: Materia = {
        ...materia,
        cor: COLORS[colorIndex],
        blocked: false,
        selected: materia.selected ?? true,
    };

    setMaterias((prev) => [...prev, newMateria]);
    const { planos, blockedMaterias } = combinacoes(materias);
    const closestIndex = findClosestCombination(currentPlano(), planos); // Find the closest combination to the current one (to avoid layout shifts)
    setMaterias(
        produce((list) => {
            for (const materia of list) {
                materia.blocked = blockedMaterias.has(materia.id);
            }
        }),
    );
    setPlanos(planos);
    setCurrentPlanoIndex(closestIndex); // Reset to first plano

    return null;
}

function removeMateria(id: string): MateriaNotFoundError | null {
    const materiaIndex = materias.findIndex((m) => m.id === id);
    if (materiaIndex === -1) return new MateriaNotFoundError(`Matéria ${id} não encontrada`);

    setMaterias((prev) => prev.filter((m) => m.id !== id));

    if (materias.length === 0) {
        // If no materias left, reset store
        setMaterias([]);
        setPlanos([]);
        setCurrentPlanoIndex(0);
        return null;
    }

    const { planos, blockedMaterias } = combinacoes(materias);
    const closestIndex = findClosestCombination(currentPlano(), planos); // Find the closest combination to the current one (to avoid layout shifts)
    setMaterias(
        produce((list) => {
            for (const materia of list) {
                materia.blocked = blockedMaterias.has(materia.id);
            }
        }),
    );
    setPlanos(planos);
    setCurrentPlanoIndex(closestIndex); // Reset to closest plano

    return null;
}

function updateMateriaSelected(id: string, selected: boolean) {
    setMaterias((materia) => materia.id === id, "selected", selected);

    const { planos, blockedMaterias } = combinacoes(materias);
    const closestIndex = findClosestCombination(currentPlano(), planos); // Find the closest combination to the current one (to avoid layout shifts)
    setMaterias(
        produce((list) => {
            for (const materia of list) {
                materia.blocked = blockedMaterias.has(materia.id);
            }
        }),
    );
    setPlanos(planos);
    setCurrentPlanoIndex(closestIndex);
}

function setPlanoIndexClamped(value: number | ((current: number) => number)) {
    if (planos.length === 0) return;

    setCurrentPlanoIndex((current) => {
        const rawIndex = typeof value === "function" ? (value as (c: number) => number)(current) : value;
        const clampedIndex = Math.max(0, Math.min(rawIndex, planos.length - 1));
        return clampedIndex;
    });
}

export const usePlano = () => ({
    materias,
    planos,
    currentPlano,
    currentPlanoIndex,
    addMateria,
    removeMateria,
    updateMateriaSelected,
    setPlanoIndex: setPlanoIndexClamped,
});
