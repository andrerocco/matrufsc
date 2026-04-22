import { makePersisted } from "@solid-primitives/storage";
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
export type SyncWarning = string;

const STORAGE_KEYS = {
    materias: "matrufsc:materias",
    currentPlanoIndex: "matrufsc:currentPlanoIndex",
    selectedMateriaId: "matrufsc:selectedMateriaId",
} as const;

const [materias, setMaterias] = makePersisted(createStore<Materia[]>([]), {
    name: STORAGE_KEYS.materias,
});
const [planos, setPlanos] = createSignal<Plano[]>([]);
const [currentPlanoIndex, setCurrentPlanoIndex] = makePersisted(createSignal(0), {
    name: STORAGE_KEYS.currentPlanoIndex,
});
const currentPlano = () => planos()[currentPlanoIndex()] ?? null;
const [selectedMateriaId, setSelectedMateriaId] = makePersisted(createSignal<string | null>(null), {
    name: STORAGE_KEYS.selectedMateriaId,
});

let colorIndex = 0;

function sanitizeSelectedMateriaId() {
    const selectedId = selectedMateriaId();
    if (!selectedId) return;

    if (!materias.some((materia) => materia.id === selectedId)) {
        setSelectedMateriaId(null);
    }
}

function applyBlockedMaterias(blockedMaterias: Set<string>) {
    setMaterias(
        produce((list) => {
            for (const materia of list) {
                materia.blocked = blockedMaterias.has(materia.id);
            }
        }),
    );
}

function recomputePlanos(options?: { preserveCurrentIndex?: boolean }) {
    const previousPlano = currentPlano();
    const { planos: nextPlanos, blockedMaterias } = combinacoes(materias);

    applyBlockedMaterias(blockedMaterias);
    setPlanos(nextPlanos);

    if (nextPlanos.length === 0) {
        setCurrentPlanoIndex(0);
    } else if (options?.preserveCurrentIndex) {
        setCurrentPlanoIndex((current) => Math.max(0, Math.min(current, nextPlanos.length - 1)));
    } else {
        const closestIndex = findClosestCombination(previousPlano, nextPlanos);
        setCurrentPlanoIndex(closestIndex);
    }

    sanitizeSelectedMateriaId();
}

function normalizeAulas(aulas: Aula[]) {
    return aulas
        .map((aula) => ({
            dia_semana: aula.dia_semana,
            horarios: [...aula.horarios],
            sala: aula.sala,
        }))
        .sort((a, b) => {
            if (a.dia_semana !== b.dia_semana) return a.dia_semana - b.dia_semana;
            if (a.horarios[0] !== b.horarios[0]) return (a.horarios[0] ?? -1) - (b.horarios[0] ?? -1);
            return a.sala.localeCompare(b.sala);
        });
}

function turmaContentFingerprint(turma: Turma) {
    const professores = [...turma.professores].sort();
    const aulas = normalizeAulas(turma.aulas);
    return JSON.stringify({
        id: turma.id,
        carga_horaria: turma.carga_horaria,
        vagas_ofertadas: turma.vagas_ofertadas,
        vagas_ocupadas: turma.vagas_ocupadas,
        professores,
        aulas,
    });
}

function turmaEquals(a: Turma, b: Turma) {
    return a.selected === b.selected && turmaContentFingerprint(a) === turmaContentFingerprint(b);
}

function materiaEquals(a: Materia, b: Materia) {
    if (a.id !== b.id) return false;
    if (a.nome !== b.nome) return false;
    if (a.cor !== b.cor) return false;
    if (a.selected !== b.selected) return false;
    if (a.turmas.length !== b.turmas.length) return false;

    for (let index = 0; index < a.turmas.length; index++) {
        if (!turmaEquals(a.turmas[index]!, b.turmas[index]!)) return false;
    }

    return true;
}

function syncMateriasFromRemote(remoteMaterias: Materia[]): SyncWarning[] {
    const remoteMateriaById = new Map(remoteMaterias.map((materia) => [materia.id, materia]));
    const warnings: SyncWarning[] = [];
    const nextMaterias: Materia[] = [];

    for (const localMateria of materias) {
        const remoteMateria = remoteMateriaById.get(localMateria.id);
        if (!remoteMateria) {
            warnings.push(`Matéria ${localMateria.id} removida da oferta e retirada do plano.`);
            continue;
        }

        const localTurmaById = new Map(localMateria.turmas.map((turma) => [turma.id, turma]));
        const hadAllTurmasSelected =
            localMateria.turmas.length > 0 && localMateria.turmas.every((turma) => turma.selected);
        const removedSelectedTurmas: string[] = [];
        const updatedSelectedTurmas: string[] = [];

        for (const localTurma of localMateria.turmas) {
            if (!localTurma.selected) continue;
            if (!remoteMateria.turmas.some((turma) => turma.id === localTurma.id)) {
                removedSelectedTurmas.push(localTurma.id);
            }
        }

        const nextTurmas = remoteMateria.turmas.map((remoteTurma) => {
            const localTurma = localTurmaById.get(remoteTurma.id);
            const selected = localTurma ? localTurma.selected : hadAllTurmasSelected;

            if (localTurma && localTurma.selected && turmaContentFingerprint(localTurma) !== turmaContentFingerprint(remoteTurma)) {
                updatedSelectedTurmas.push(remoteTurma.id);
            }

            return {
                ...remoteTurma,
                selected,
            };
        });

        if (removedSelectedTurmas.length > 0) {
            warnings.push(
                `Matéria ${localMateria.id}: turmas selecionadas removidas da oferta (${removedSelectedTurmas.join(", ")}).`,
            );
        }

        if (updatedSelectedTurmas.length > 0) {
            warnings.push(
                `Matéria ${localMateria.id}: turmas selecionadas atualizadas (${updatedSelectedTurmas.join(", ")}).`,
            );
        }

        if (localMateria.selected && localMateria.nome !== remoteMateria.nome) {
            warnings.push(`Matéria ${localMateria.id}: nome atualizado para "${remoteMateria.nome}".`);
        }

        let nextMateriaSelected = localMateria.selected;

        if (nextMateriaSelected && nextTurmas.length === 0) {
            nextMateriaSelected = false;
            warnings.push(`Matéria ${localMateria.id}: sem turmas disponíveis na oferta atual; matéria desmarcada.`);
        } else if (nextMateriaSelected && nextTurmas.every((turma) => !turma.selected)) {
            for (const turma of nextTurmas) turma.selected = true;
            warnings.push(`Matéria ${localMateria.id}: seleção de turmas recriada automaticamente.`);
        }

        nextMaterias.push({
            id: remoteMateria.id,
            nome: remoteMateria.nome,
            turmas: nextTurmas,
            cor: localMateria.cor,
            selected: nextMateriaSelected,
            blocked: false,
        });
    }

    let changed = nextMaterias.length !== materias.length;
    if (!changed) {
        for (let index = 0; index < materias.length; index++) {
            if (!materiaEquals(materias[index]!, nextMaterias[index]!)) {
                changed = true;
                break;
            }
        }
    }

    if (changed) {
        setMaterias(nextMaterias);
        recomputePlanos();
    }

    return warnings;
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
    recomputePlanos();
}

function removeMateria(id: string) {
    const materiaIndex = materias.findIndex((m) => m.id === id);
    if (materiaIndex === -1) throw new MateriaNotFoundError(`Matéria ${id} não encontrada`);

    if (selectedMateriaId() === id) setSelectedMateriaId(null);
    setMaterias((prev) => prev.filter((m) => m.id !== id));
    recomputePlanos();
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
    recomputePlanos();
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
    recomputePlanos();
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

// Rebuild derived state after localStorage hydration.
recomputePlanos({ preserveCurrentIndex: true });

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
    syncMateriasFromRemote,
});
