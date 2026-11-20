export function normalize(s: string): string {
    return s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .trim();
}

export function normalizeWords(s: string): string[] {
    return normalize(s)
        .split(/[^A-Z0-9]+/)
        .filter(Boolean);
}
