import { HORAS } from "~/context/plano/constants";
import type { Materia, Plano, Turma } from "./Plano.store";

export function combinacoes(materias: Materia[]): {
    planos: Plano[];
    blockedMaterias: Set<string>;
} {
    // console.log("Materias: ", materias);

    // Step 1: Filter out unselected materias
    const selectedMaterias = materias.filter((materia) => materia.selected);
    // console.log("Selected materias: ", selectedMaterias); // Fixed this line to show selectedMaterias, not materias

    // Step 2: Merge equivalent turmas
    const materiaWithRepresentingTurma = selectedMaterias.map((materia) => {
        const selectedTurmas = materia.turmas.filter((turma) => turma.selected);
        const mergedTurmas = mergeEquivalentTurmas(selectedTurmas);
        return { turmas: mergedTurmas, materia };
    });
    // console.log("Materia with representing turma: ", materiaWithRepresentingTurma);

    // Step 3: Process each materia incrementally
    let combinacoes: Plano[] = [];
    const blockedMaterias = new Set<string>();

    for (const { turmas, materia } of materiaWithRepresentingTurma) {
        if (combinacoes.length === 0) {
            // Initial case: First materia added, create a combination with one turma from each equivalent group
            combinacoes = Object.values(turmas).map((turmaGroup) => [{ materia, turma: turmaGroup[0] }]);
        } else {
            // Try to add the materia to each existing combination
            let updatedCombinacoes: Plano[] = [];
            let couldAddMateria = false;

            // console.log("Combinacoes: ", combinacoes);
            for (const combinacao of combinacoes) {
                // For each equivalent turma group, try to add one representative turma
                for (const turmaGroup of Object.values(turmas)) {
                    const turma = turmaGroup[0]; // Take the first turma as representative
                    if (!hasConflict(turma, combinacao)) {
                        couldAddMateria = true;
                        updatedCombinacoes.push([...combinacao, { materia, turma }]);
                    }
                }
            }

            if (!couldAddMateria) {
                blockedMaterias.add(materia.id);
                // If this materia is blocked, keep the previous combinations and set as blocked
            } else {
                combinacoes = updatedCombinacoes;
            }
        }
    }

    if (combinacoes.length === 0) {
        return { planos: [], blockedMaterias: blockedMaterias };
    }

    // Sort combinations by calculated weights
    const weightedCombinations = combinacoes.map((combination) => ({
        combination,
        ...calculateCombinationWeight(combination.map(({ turma }) => turma)),
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

function mergeEquivalentTurmas(turmas: Turma[]) {
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

function hasConflict(turma: Turma, combinacao: Plano): boolean {
    // Turmas with empty aulas never conflict
    if (turma.aulas.length === 0) {
        return false;
    }

    // Build a schedule from the combination
    const horarios = new Map<string, boolean>();

    for (const { turma: existingTurma } of combinacao) {
        for (const aula of existingTurma.aulas) {
            for (const horario of aula.horarios) {
                const key = `${aula.dia_semana}_${horario}`;
                horarios.set(key, true);
            }
        }
    }

    // Check if turma conflicts with the schedule
    for (const aula of turma.aulas) {
        for (const horario of aula.horarios) {
            const key = `${aula.dia_semana}_${horario}`;
            if (horarios.has(key)) return true;
        }
    }

    return false;
}

// TODO: Conferir
/**
 * Calculates heuristic metrics for a combination of turmas.
 * Returns:
 * - sortDias: Number of days with classes (lower is better).
 * - sortJanelas: Total empty slots between first and last class per day (lower is better).
 * - sortPeso: Tie-breaker, sum of timeline indices (diaIndex * HORAS.length + slotIndex) for occupied slots; smaller is better (earlier classes).
 * Assumptions:
 * - dia_semana in [1,7] (1=Sunday, 7=Saturday).
 * - horarios are valid indices into HORAS.
 * - Combinations are conflict-free.
 */
function calculateCombinationWeight(combination: Turma[]): { sortPeso: number; sortDias: number; sortJanelas: number } {
    const NUM_DIAS = 7; // 1 = domingo, ..., 7 = sábado
    const NUM_SLOTS = HORAS.length; // number of possible horários in a day

    // Matriz booleana: occupied[dia][slot] indica se há aula naquele horário
    const occupied: boolean[][] = Array.from({ length: NUM_DIAS }, () => Array<boolean>(NUM_SLOTS).fill(false));

    // Preenche a matriz de ocupação com as aulas da combinação
    for (const turma of combination) {
        for (const aula of turma.aulas) {
            const diaIndex = aula.dia_semana - 1; // 1..7 -> 0..6

            // Segurança extra: evita quebrar se vier dia_semana inválido
            if (diaIndex < 0 || diaIndex >= NUM_DIAS) {
                console.warn("calculateCombinationWeight: dia_semana out of range (1..7) for turma=", turma);
                continue;
            }

            for (const horarioIndex of aula.horarios) {
                if (horarioIndex < 0 || horarioIndex >= NUM_SLOTS) {
                    console.warn("calculateCombinationWeight: horarioIndex out of range for turma=", turma);
                    continue;
                }

                occupied[diaIndex][horarioIndex] = true;
            }
        }
    }

    let sortDias = 0; // número de dias com pelo menos uma aula
    let sortJanelas = 0; // total de janelas na semana
    let sortPeso = 0; // menor é melhor (menos / mais cedo)

    // TODO: Conferir
    // Percorre cada dia para calcular dias, janelas e peso
    for (let dia = 0; dia < NUM_DIAS; dia++) {
        const daySlots = occupied[dia];

        let firstSlot = -1;
        let lastSlot = -1;
        let dayOccupiedCount = 0;

        for (let slot = 0; slot < NUM_SLOTS; slot++) {
            if (!daySlots[slot]) continue;
            dayOccupiedCount++;

            if (firstSlot === -1) firstSlot = slot;
            lastSlot = slot;

            // Índice de linha do tempo: mais cedo na semana/dia = menor valor
            const timelineIndex = dia * NUM_SLOTS + slot;
            sortPeso += timelineIndex;
        }

        if (dayOccupiedCount === 0) continue; // Nenhuma aula neste dia

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

    let bestMatch = 0;
    let bestScore = 0;

    allCombos.forEach((combo, index) => {
        let score = 0;

        // Score for matching materias
        combo.forEach(({ materia }) => {
            if (currentCombo.some((item) => item.materia.id === materia.id)) {
                score += 10;
            }
        });

        // Higher score for matching turmas
        combo.forEach(({ materia, turma }) => {
            currentCombo.forEach((item) => {
                if (item.materia.id === materia.id && item.turma.id === turma.id) {
                    score += 100;
                }
            });
        });

        if (score > bestScore) {
            bestScore = score;
            bestMatch = index;
        }
    });

    return bestMatch;
}
