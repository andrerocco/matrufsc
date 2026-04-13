export interface HorariosDescriptor<T> {
    [dia: number]: {
        [hora: string]: T | null;
    };
}

export interface HorarioCellBase {
    id: string;
    turmaId: string;
    sala: string;
    color: string;
}

export interface HorarioCellOverlay {
    id: string;
    turmaId: string;
    sala: string;
}
