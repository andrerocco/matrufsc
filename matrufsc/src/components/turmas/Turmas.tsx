import { createContext, useContext, useState } from "react";
import { Materia, Turma } from "~/lib/combinacoes";
import { usePlanoStore } from "~/providers/plano/store";
import { useHorariosStore } from "../horarios/Horarios";

const TurmasListContext = createContext<{
    materia: Materia | null;
    open: (materia: Materia) => void;
}>({
    materia: null,
    open: () => {},
});

export function TurmasListProvider({ children }: { children: React.ReactNode }) {
    const [materia, setmateria] = useState<Materia | null>(null);

    const open = (newMateria: Materia) => {
        if (materia === newMateria) {
            setmateria(null); // Close the list if already open
            return;
        }
        setmateria(newMateria);
    };

    return (
        <TurmasListContext.Provider
            value={{
                materia,
                open,
            }}
        >
            {children}
        </TurmasListContext.Provider>
    );
}

export function useTurmasList() {
    const context = useContext(TurmasListContext);
    if (!context) {
        throw new Error("useTurmasList must be used within a TurmasListProvider");
    }
    return context;
}

export default function Turmas() {
    const { materia: contextMateria } = useTurmasList();

    // Get the fresh materia data from the store
    const materias = usePlanoStore((state) => state.materias);
    const updateTurmaSelection = usePlanoStore((state) => state.updateTurmaSelection);
    const updateMateriaSelection = usePlanoStore((state) => state.updateMateriaSelection);
    const setOverlay = useHorariosStore((state) => state.setOverlay);
    const clearOverlay = useHorariosStore((state) => state.clear);

    if (!contextMateria) return;

    // TODO: Temp
    const materia = materias.find((m) => m.id === contextMateria.id);
    if (!materia) return;

    const handleHighlightTurma = (turma: Turma) => {
        setOverlay(materia.id, turma.aulas);
    };

    const handleSelectTurma = (turmaId: string, selected: boolean) => {
        updateTurmaSelection(materia.id, turmaId, selected);

        // TODO: Edge case fix, think of a better architecture that avoids this
        // If we're deselecting a turma, check if it will be the last one
        if (!selected) {
            // Calculate what the state will be after this update
            const remainingSelectedTurmas = materia.turmas.filter((t) => t.selected && t.id !== turmaId);

            if (remainingSelectedTurmas.length === 0) {
                updateMateriaSelection(materia.id, false); // TODO: Should this be handled in the store?
                clearOverlay();
            }
        }
    };

    return (
        <div className="relative my-6 h-fit overflow-hidden rounded-md border border-neutral-400 bg-neutral-100">
            <div
                className="w-full border-b border-neutral-400 bg-neutral-200 px-2 py-1"
                style={{ backgroundColor: materia.cor }}
            >
                <p className="text-sm font-semibold">
                    {materia.id} - {materia.nome}
                </p>
            </div>
            {materia.turmas.map((turma, index) => (
                <div
                    key={index}
                    className="flex min-w-[350px] flex-row gap-1 px-2 py-1"
                    onMouseOver={() => handleHighlightTurma(turma)}
                    onMouseOut={clearOverlay}
                >
                    <div>
                        <input
                            type="checkbox"
                            checked={turma.selected}
                            onChange={() => handleSelectTurma(turma.id, !turma.selected)}
                        />
                    </div>
                    <div>
                        <p className="text-nowrap text-sm font-semibold">
                            {turma.id} - {turma.professores.map((professor) => professor).join(", ")}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}
