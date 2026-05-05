import { HORAS } from "~/context/plano/constants";
import type { Materia, Plano, Turma } from "./Plano.store";

const NUM_DIAS = 7; // 1 = domingo, ..., 7 = sabado
const NUM_SLOTS = HORAS.length;

type ScheduleMask = number[];

interface TurmaOption {
    turma: Turma;
    mask: ScheduleMask;
}

interface CombinationState {
    plano: Plano;
    mask: ScheduleMask;
}

export function combinacoes(materias: Materia[]): {
    planos: Plano[];
    blockedMaterias: Set<string>;
} {
    const materiaOptions = materias
        .filter((materia) => materia.selected) // Step 1: Filter out unselected materias
        .map((materia) => {
            // Step 2: Merge equivalent turmas and precompute each representative turma schedule
            const selectedTurmas = materia.turmas.filter((turma) => turma.selected);
            const mergedTurmas = mergeEquivalentTurmas(selectedTurmas);
            const options = Object.values(mergedTurmas).map<TurmaOption>((turmaGroup) => {
                const turma = turmaGroup[0]; // Take the first turma as representative
                return { turma, mask: createTurmaMask(turma) };
            });

            return { materia, options };
        });

    // Step 3: Process each materia incrementally
    let combinationStates: CombinationState[] = [];
    const blockedMaterias = new Set<string>();

    for (const { options, materia } of materiaOptions) {
        if (combinationStates.length === 0) {
            // Initial case: First materia added, create a combination with one turma from each equivalent group
            combinationStates = options.map((option) => ({
                plano: [{ materia, turma: option.turma }],
                mask: [...option.mask],
            }));
        } else {
            // Try to add the materia to each existing combination
            const updatedCombinacoes: CombinationState[] = [];
            let couldAddMateria = false;

            for (const combination of combinationStates) {
                // For each equivalent turma group, try to add one representative turma
                for (const option of options) {
                    if (!hasMaskConflict(option.mask, combination.mask)) {
                        couldAddMateria = true;
                        updatedCombinacoes.push({
                            plano: [...combination.plano, { materia, turma: option.turma }],
                            mask: mergeMasks(combination.mask, option.mask),
                        });
                    }
                }
            }

            if (!couldAddMateria) {
                blockedMaterias.add(materia.id);
                // If this materia is blocked, keep the previous combinations and set as blocked
            } else {
                combinationStates = updatedCombinacoes;
            }
        }
    }

    if (combinationStates.length === 0) {
        return { planos: [], blockedMaterias: blockedMaterias };
    }

    // Sort combinations by calculated weights
    const weightedCombinations = combinationStates.map((combination) => ({
        combination: combination.plano,
        ...calculateWeight(combination.mask),
    }));

    weightedCombinations.sort((a, b) => {
        // First sort by number of days (fewer is better)
        if (a.sortDias !== b.sortDias) {
            return a.sortDias - b.sortDias;
        }
        // Then by number of windows (fewer is better)
        if (a.sortJanelas !== b.sortJanelas) {
            return a.sortJanelas - b.sortJanelas;
        }
        // Finally by weight (earlier classes are better)
        return a.sortPeso - b.sortPeso;
    });

    return {
        planos: weightedCombinations.map((weightedCombo) => weightedCombo.combination),
        blockedMaterias,
    };
}

export function mergeEquivalentTurmas(turmas: Turma[]) {
    let mergedTurmas: Record<string, Turma[]> = {};

    for (const turma of turmas) {
        // Handle turmas with empty aulas list as a special case
        if (turma.aulas.length === 0) {
            const emptyKey = "SEM_AULAS";
            if (!mergedTurmas[emptyKey]) {
                mergedTurmas[emptyKey] = [];
            }
            mergedTurmas[emptyKey].push(turma);
            continue;
        }

        const flatennedHorariosForTurma = turma.aulas //
            .map((aula) => {
                const firstHorarioString = HORAS[aula.horarios[0]];
                const lastHorarioString = HORAS[aula.horarios[aula.horarios.length - 1]];
                return `${aula.dia_semana}_${firstHorarioString}-${lastHorarioString}`;
            }) // Transforma cada bloco de aulas em uma string plana, ex. '2_0730-0910'
            .sort() // Ordena para garantir que a chave seja única
            .join("/"); // Junta cada bloco de aula em uma única string

        if (!mergedTurmas[flatennedHorariosForTurma]) {
            mergedTurmas[flatennedHorariosForTurma] = [];
        }

        mergedTurmas[flatennedHorariosForTurma].push(turma);
    }

    return mergedTurmas;
}

function createTurmaMask(turma: Turma): ScheduleMask {
    const mask = createEmptyMask();

    for (const aula of turma.aulas) {
        const diaIndex = aula.dia_semana - 1;
        if (diaIndex < 0 || diaIndex >= NUM_DIAS) continue;

        for (const horarioIndex of aula.horarios) {
            if (horarioIndex < 0 || horarioIndex >= NUM_SLOTS) continue;
            mask[diaIndex] |= 1 << horarioIndex;
        }
    }

    return mask;
}

function createEmptyMask(): ScheduleMask {
    return Array<number>(NUM_DIAS).fill(0);
}

function hasMaskConflict(a: ScheduleMask, b: ScheduleMask): boolean {
    for (let dia = 0; dia < NUM_DIAS; dia++) {
        if ((a[dia] & b[dia]) !== 0) return true;
    }

    return false;
}

function mergeMasks(a: ScheduleMask, b: ScheduleMask): ScheduleMask {
    const mask = createEmptyMask();

    for (let dia = 0; dia < NUM_DIAS; dia++) {
        mask[dia] = a[dia] | b[dia];
    }

    return mask;
}

/**
 * Calculates heuristic metrics for a weekly schedule mask.
 * Returns:
 * - sortDias: Number of days with classes (lower is better).
 * - sortJanelas: Total empty slots between first and last class per day (lower is better).
 * - sortPeso: Tie-breaker, sum of timeline indices (diaIndex * HORAS.length + slotIndex) for occupied slots; smaller is better (earlier classes).
 * Assumptions:
 * - dia_semana in [1,7] (1=Sunday, 7=Saturday).
 * - horarios are valid indices into HORAS.
 * - Combinations are conflict-free.
 */
function calculateWeight(mask: ScheduleMask): { sortPeso: number; sortDias: number; sortJanelas: number } {
    let sortDias = 0; // número de dias com pelo menos uma aula
    let sortJanelas = 0; // total de janelas na semana
    let sortPeso = 0; // menor é melhor (menos / mais cedo)

    // TODO: Conferir
    // Percorre cada dia para calcular dias, janelas e peso
    for (let dia = 0; dia < NUM_DIAS; dia++) {
        const dayMask = mask[dia];
        if (dayMask === 0) continue;

        let firstSlot = -1;
        let lastSlot = -1;
        let dayOccupiedCount = 0;

        for (let slot = 0; slot < NUM_SLOTS; slot++) {
            if ((dayMask & (1 << slot)) === 0) continue;
            dayOccupiedCount++;

            if (firstSlot === -1) firstSlot = slot;
            lastSlot = slot;

            // Índice de linha do tempo: mais cedo na semana/dia = menor valor
            const timelineIndex = dia * NUM_SLOTS + slot;
            sortPeso += timelineIndex;
        }

        sortDias++;

        // Janelas = slots vazios entre a primeira e a última aula do dia
        const faixaTotal = lastSlot - firstSlot + 1; // slots entre primeira e última (inclusive)
        const janelasNoDia = faixaTotal - dayOccupiedCount;
        sortJanelas += Math.max(0, janelasNoDia);
    }

    return { sortPeso, sortDias, sortJanelas };
}

export function findClosestCombination(currentCombo: Plano | null, allCombos: Plano[]): number {
    if (!currentCombo || allCombos.length === 0) return 0;

    const currentMateriaIds = new Set(currentCombo.map(({ materia }) => materia.id));
    const currentTurmaIdByMateriaId = new Map(currentCombo.map(({ materia, turma }) => [materia.id, turma.id]));

    let bestMatch = 0;
    let bestScore = 0;

    allCombos.forEach((combo, index) => {
        let score = 0;

        for (const { materia, turma } of combo) {
            if (currentMateriaIds.has(materia.id)) {
                score += 10;

                if (currentTurmaIdByMateriaId.get(materia.id) === turma.id) {
                    score += 100;
                }
            }
        }

        if (score > bestScore) {
            bestScore = score;
            bestMatch = index;
        }
    });

    return bestMatch;
}
