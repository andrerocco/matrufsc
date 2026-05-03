import { createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { combinacoes, findClosestCombination } from "~/context/plano/combinacoes";
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
    vagas_ofertadas: number;
    vagas_ocupadas: number;
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

export type Plano = { materia: Materia; turma: Turma }[];

const [materias, setMaterias] = createStore<Materia[]>([]);
const [planos, setPlanos] = createSignal<Plano[]>([]);
const [currentPlanoIndex, setCurrentPlanoIndex] = createSignal(0);
const currentPlano = () => planos()[currentPlanoIndex()] ?? null;
const [selectedMateriaId, setSelectedMateriaId] = createSignal<string | null>(null);

let colorIndex = 0;

function refreshPlanos() {
    const { planos: newPlanos, blockedMaterias } = combinacoes(materias);
    const closestIndex = findClosestCombination(currentPlano(), newPlanos);
    setMaterias(
        produce((list) => {
            for (const materia of list) {
                materia.blocked = blockedMaterias.has(materia.id);
            }
        }),
    );
    setPlanos(newPlanos);
    setCurrentPlanoIndex(closestIndex);
}

function addMateria(materia: Materia) {
    const exists = materias.find((m) => m.id === materia.id); // Check if materia already exists
    if (exists) throw new MateriaExistsError(`${materia.id} já adicionada ao plano`);

    colorIndex = (colorIndex + 1) % COLORS.length;

    // Add metadata to the new materia
    const newMateria: Materia = {
        ...materia,
        cor: COLORS[colorIndex],
        blocked: false,
        selected: materia.selected ?? true,
    };

    setMaterias((prev) => [...prev, newMateria]);
    setSelectedMateriaId(newMateria.id);
    refreshPlanos();
}

function removeMateria(id: string) {
    const materiaIndex = materias.findIndex((m) => m.id === id);
    if (materiaIndex === -1) throw new MateriaNotFoundError(`Matéria ${id} não encontrada`);

    if (selectedMateriaId() === id) setSelectedMateriaId(null);
    setMaterias((prev) => prev.filter((m) => m.id !== id));

    if (materias.length === 0) {
        // If no materias left, reset store
        setMaterias([]);
        setPlanos([]);
        setCurrentPlanoIndex(0);
        setSelectedMateriaId(null);
    } else {
        refreshPlanos();
    }
}

function updateMateriaSelected(id: string, selected: boolean) {
    setMaterias(
        produce((list) => {
            const materia = list.find((item) => item.id === id);
            if (!materia) return;

            materia.selected = selected;

            // If the materia is being selected and has no selected turmas, select all its turmas by default
            if (selected && materia.turmas.every((turma) => !turma.selected)) {
                for (const turma of materia.turmas) turma.selected = true;
            }
        }),
    );

    refreshPlanos();
}

function updateTurmasSelected(materiaId: string, turmaIds: string[], selected: boolean) {
    const turmaIdSet = new Set(turmaIds);

    setMaterias(
        produce((list) => {
            const materia = list.find((item) => item.id === materiaId);
            if (!materia) return;

            for (const turma of materia.turmas) {
                if (turmaIdSet.has(turma.id)) turma.selected = selected;
            }

            // If any turma is explicitly enabled, enable the parent materia too.
            if (selected) materia.selected = true;

            // Prevent invalid state: selected materia with zero selected turmas.
            if (materia.selected && materia.turmas.every((turma) => !turma.selected)) materia.selected = false;
        }),
    );
    refreshPlanos();
}

function setPlanoIndexClamped(value: number | ((current: number) => number)) {
    const currentPlanos = planos();
    if (currentPlanos.length === 0) return;

    setCurrentPlanoIndex((current) => {
        const rawIndex = typeof value === "function" ? (value as (c: number) => number)(current) : value;
        const clampedIndex = Math.max(0, Math.min(rawIndex, currentPlanos.length - 1));
        return clampedIndex;
    });
}

export const usePlano = () => ({
    materias,
    planos,
    currentPlano,
    currentPlanoIndex,
    selectedMateriaId,
    setSelectedMateriaId,
    addMateria,
    removeMateria,
    updateMateriaSelected,
    updateTurmasSelected,
    setPlanoIndex: setPlanoIndexClamped,
});
