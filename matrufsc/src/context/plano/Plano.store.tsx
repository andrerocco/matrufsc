import { batch, createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { combinacoes, findClosestCombination } from "~/context/plano/combinacoes";
import { MateriaExistsError, MateriaNotFoundError } from "./errors";
import { COLORS } from "./constants";

export interface Aula {
    dia_semana: number; // 1 = domingo, 2 = segunda, ..., 7 = sábado
    horarios: number[]; // Indexes of HORAS array
    sala: string;
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
    campus: string;
    semester: string;
    turmas: Turma[];
    cor?: string;
    selected: boolean;
    blocked?: boolean;
}

export type Plano = { materia: Materia; turma: Turma }[];

const [materias, setMaterias] = createStore<Materia[]>([]);
const [planos, setPlanos] = createSignal<Plano[]>([]);
const [currentPlanoIndex, setCurrentPlanoIndex] = createSignal(0);
const [focusedMateriaId, setFocusedMateriaId] = createSignal<string | null>(null);

const currentPlano = () => planos()[currentPlanoIndex()] ?? null;

let colorIndex = 0;

function nextColor(): string | undefined {
    if (COLORS.length === 0) return undefined;

    colorIndex = (colorIndex + 1) % COLORS.length;
    return COLORS[colorIndex];
}

function withMateriaMetadata(materia: Materia, cor: string | undefined): Materia {
    const turmas = materia.turmas.map((turma) => ({
        ...turma,
        selected: turma.selected ?? true,
    }));

    const selected = materia.selected ?? true;

    return {
        ...materia,
        cor,
        blocked: false,
        selected: selected && turmas.every((turma) => !turma.selected) ? false : selected,
        turmas,
    };
}

function resetPlanoState() {
    setPlanos([]);
    setCurrentPlanoIndex(0);
    setFocusedMateriaId(null);
}

/**
 * Recomputes all state derived from `materias`.
 */
function refreshPlanos() {
    const previousPlano = currentPlano();
    const { planos: newPlanos, blockedMaterias } = combinacoes(materias);

    const closestIndex = findClosestCombination(previousPlano, newPlanos);

    setMaterias(
        produce((list) => {
            for (const materia of list) {
                const blocked = blockedMaterias.has(materia.id);

                if (materia.blocked !== blocked) {
                    materia.blocked = blocked;
                }
            }
        }),
    );

    setPlanos(newPlanos);
    setCurrentPlanoIndex(closestIndex);
}

/**
 * Transaction boundary for all mutators that change `materias`.
 */
function commitMateriaChange(change: () => void) {
    batch(() => {
        change();

        if (materias.length === 0) {
            resetPlanoState();
            return;
        }

        refreshPlanos();
    });
}

/// Mutators

function addMateria(materia: Materia) {
    const exists = materias.some((m) => m.id === materia.id);
    if (exists) throw new MateriaExistsError(`${materia.id} já adicionada ao plano`);

    const newMateria = withMateriaMetadata(materia, nextColor());

    commitMateriaChange(() => {
        setMaterias((prev) => [...prev, newMateria]);
        setFocusedMateriaId(newMateria.id);
    });
}

function removeMateria(id: string) {
    const exists = materias.some((m) => m.id === id);
    if (!exists) throw new MateriaNotFoundError(`Matéria ${id} não encontrada`);

    commitMateriaChange(() => {
        if (focusedMateriaId() === id) {
            setFocusedMateriaId(null);
        }

        setMaterias((prev) => prev.filter((m) => m.id !== id));
    });
}

function moveMateria(id: string, direction: "up" | "down") {
    const index = materias.findIndex((m) => m.id === id);
    if (index === -1) throw new MateriaNotFoundError(`Matéria ${id} não encontrada`);

    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= materias.length) return; // Já está no limite da lista

    commitMateriaChange(() => {
        setMaterias(
            produce((list) => {
                const [item] = list.splice(index, 1);
                list.splice(target, 0, item);
            }),
        );
    });
}

function updateMateriaSelected(id: string, selected: boolean) {
    commitMateriaChange(() => {
        setMaterias(
            produce((list) => {
                const materia = list.find((item) => item.id === id);
                if (!materia) return;

                materia.selected = selected;

                // If the materia is being selected and has no selected turmas,
                // select all its turmas by default.
                if (selected && materia.turmas.every((turma) => !turma.selected)) {
                    for (const turma of materia.turmas) turma.selected = true;
                }
            }),
        );
    });
}

function updateTurmasSelected(materiaId: string, turmaIds: string[], selected: boolean) {
    const turmaIdSet = new Set(turmaIds);

    commitMateriaChange(() => {
        setMaterias(
            produce((list) => {
                const materia = list.find((item) => item.id === materiaId);
                if (!materia) return;

                for (const turma of materia.turmas) {
                    if (!turmaIdSet.has(turma.id)) continue;
                    turma.selected = selected;
                }

                // If any turma is explicitly enabled, enable the parent materia too.
                if (selected) materia.selected = true;

                // Prevent invalid state: selected materia with zero selected turmas.
                if (materia.selected && materia.turmas.every((turma) => !turma.selected)) {
                    materia.selected = false;
                }
            }),
        );
    });
}

function setPlanoIndexClamped(value: number | ((current: number) => number)) {
    const currentPlanos = planos();
    if (currentPlanos.length === 0) return;

    setCurrentPlanoIndex((current) => {
        const rawIndex = typeof value === "function" ? value(current) : value;
        return Math.max(0, Math.min(rawIndex, currentPlanos.length - 1));
    });
}

function replaceMaterias(nextMaterias: Materia[]) {
    colorIndex = 0;

    const materiasWithMetadata = nextMaterias.map((materia) => {
        const fallbackColor = nextColor();
        return withMateriaMetadata(materia, materia.cor ?? fallbackColor);
    });

    const nextMateriaIds = new Set(materiasWithMetadata.map((materia) => materia.id));

    commitMateriaChange(() => {
        setMaterias(materiasWithMetadata);

        const focusedId = focusedMateriaId();
        if (focusedId && !nextMateriaIds.has(focusedId)) setFocusedMateriaId(null);
    });
}

export const usePlano = () => ({
    materias,
    setMaterias: replaceMaterias,
    planos,
    currentPlano,
    currentPlanoIndex,
    focusedMateriaId,
    setFocusedMateriaId,
    addMateria,
    removeMateria,
    moveMateria,
    updateMateriaSelected,
    updateTurmasSelected,
    setPlanoIndex: setPlanoIndexClamped,
});
