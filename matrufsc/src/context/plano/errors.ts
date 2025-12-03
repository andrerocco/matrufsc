export class MateriaExistsError extends Error {
    constructor(message = "Matéria já adicionada ao plano") {
        super(message);
        this.name = "MateriaExistsError";
    }
}

export class MateriaNotFoundError extends Error {
    constructor(message = "Matéria não encontrada") {
        super(message);
        this.name = "MateriaNotFoundError";
    }
}
