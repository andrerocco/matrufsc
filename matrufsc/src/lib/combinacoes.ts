import { HORAS } from "~/providers/plano/constants";
import { Aula, Materia, Turma } from "~/providers/plano/store";

// type Cell = {
//     materia: Materia;
//     horarios: Turma[];
// };
// type Combinacoes = Record<number, Record<number, Cell>>;

function mergeEquivalentTurmas(turmas: Turma[]) {
    let mergedTurmas: Record<string, Turma[]> = {};

    turmas = turmas.filter((turma) => turma.selected); // TODO: Do this here or in getCombinacoes?

    for (const turma of turmas) {
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

// TODO: Combination? Combinacao?
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

// Função auxiliar para verificar conflitos de horário
export function getCombinacoes(materias: Materia[]): Turma[][] {
    // Passo 1: Preparar as turmas agrupando as equivalentes e filtrando as selecionadas
    const turmasPorMateria = materias.map((materia) => {
        const mergedTurmas = mergeEquivalentTurmas(materia.turmas);
        return Object.values(mergedTurmas).map((group) => group[0]); // Escolhe uma turma representativa por grupo
        // TODO: Ao invés de escolher a turma representativa, mantém a mergedTurmas e retorna ela. Deixa o frontend escolher qual a turma representativa.
    });

    // Função auxiliar para verificar conflitos de horários
    const hasConflict = (selected: Turma[], newTurma: Turma): boolean => {
        const schedule = new Map<string, boolean>();

        // Marcar horários das turmas já selecionadas
        for (const turma of selected) {
            for (const aula of turma.aulas) {
                for (const horario of aula.horarios) {
                    const key = `${aula.dia_semana}_${horario}`;
                    schedule.set(key, true);
                }
            }
        }

        // Verificar conflitos com a nova turma
        for (const aula of newTurma.aulas) {
            for (const horario of aula.horarios) {
                const key = `${aula.dia_semana}_${horario}`;
                if (schedule.has(key)) return true; // Conflito encontrado
            }
        }

        return false;
    };

    // Passo 2: Gerar combinações utilizando backtracking
    const result: Turma[][] = [];

    const backtrack = (materiaIndex: number, selected: Turma[]) => {
        // Caso base: todas as matérias foram processadas
        if (materiaIndex === turmasPorMateria.length) {
            result.push([...selected]); // Adiciona a combinação ao resultado
            return;
        }

        // Iterar sobre as turmas da matéria atual
        for (const turma of turmasPorMateria[materiaIndex]) {
            if (!hasConflict(selected, turma)) {
                selected.push(turma); // Adiciona a turma à combinação atual
                backtrack(materiaIndex + 1, selected); // Próxima matéria
                selected.pop(); // Remove a turma para explorar outras combinações
            }
        }
    };

    backtrack(0, []);

    // Passo 3: Calcular pesos das combinações e utilizá-los para ordenar o resultado
    const weightedCombinations = result.map((combination) => ({
        combination,
        ...calculateCombinationWeight(combination),
    }));

    weightedCombinations.sort((a, b) => a.sortPeso - b.sortPeso);

    return weightedCombinations.map((weightedCombo) => weightedCombo.combination);
}
