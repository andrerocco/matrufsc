import { HORAS } from "~/context/plano/constants";

export interface Aula {
    dia_semana: number; // 1 = domingo, 2 = segunda, ..., 7 = sábado
    horarios: number[]; // Indexes of HORAS array (e.g. [0, 1, 2] = 07:30, 08:20, 09:10)
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
    selected: boolean; // User selected
    blocked?: boolean; // Can't fit in the Plano (this is set by the algorithm)
}

export type Plano = { materia: Materia; turma: Turma }[];

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
 * Calculates weight metrics for a combination of classes (turmas).
 * The function evaluates the schedule distribution and returns three metrics:
 * - Weight (sortPeso): Sum of hour indices where classes are scheduled
 * - Days (sortDias): Number of days with scheduled classes
 * - Windows (sortJanelas): Number of empty slots between first and last class of each day
 *
 * @param combination - Array of Turma objects representing a possible schedule combination
 * @returns An object containing:
 *   - sortPeso: Numerical weight based on class hour distribution
 *   - sortDias: Number of days containing classes
 *   - sortJanelas: Total number of empty slots between classes
 *
 * @example
 * const turmas = [turma1, turma2]; // Array of Turma objects
 * const metrics = calculateCombinationWeight(turmas);
 * // Returns: { sortPeso: number, sortDias: number, sortJanelas: number }
 */
function calculateCombinationWeight(combination: Turma[]): { sortPeso: number; sortDias: number; sortJanelas: number } {
    const schedule: Array<Array<Aula | null>> = Array.from({ length: 6 }, () => Array(14).fill(null));

    // Populate schedule with classes
    combination.forEach((turma) => {
        turma.aulas.forEach((aula) => {
            aula.horarios.forEach((horarioIndex) => {
                schedule[aula.dia_semana - 1][horarioIndex] = aula;
            });
        });
    });

    // Calculate weights similar to original algorithm
    let peso = 0;
    let dias = 0;
    let janelas = 0;

    for (let dia = 0; dia < 6; dia++) {
        const diayClasses = schedule[dia].filter((aula) => aula !== null);

        if (diayClasses.length > 0) {
            // Calculate windows (janelas)
            const firstClassIndex = schedule[dia].findIndex((aula) => aula !== null);
            const lastClassIndex = schedule[dia].lastIndexOf(diayClasses[diayClasses.length - 1]);
            janelas += Math.max(0, lastClassIndex - firstClassIndex + 1 - diayClasses.length);

            dias++;

            // Calculate weight based on class hours
            diayClasses.forEach((_, hora) => {
                peso += hora;
            });
        }
    }

    return { sortPeso: peso, sortDias: dias, sortJanelas: janelas };
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
