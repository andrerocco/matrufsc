export const TOKEN_KEYS = ["curso", "professor", "departamento"] as const;
export type TokenKey = (typeof TOKEN_KEYS)[number];

export interface TokenValue {
    id: string;
    nome: string;
}

export interface TextSegment {
    kind: "text";
    text: string;
}

export interface EditingChip {
    kind: "chip";
    key: TokenKey;
    status: "editing";
    value: string;
}

export interface ClosedChip {
    kind: "chip";
    key: TokenKey;
    status: "closed";
    selected: TokenValue;
}

export type Chip = EditingChip | ClosedChip;
export type Segment = TextSegment | Chip;

export interface Line {
    segments: Segment[];
    caret: number;
}

export type SearchRow<T> = { kind: "item"; item: T } | { kind: "token"; key: TokenKey; value: TokenValue };

export const text = (text: string): TextSegment => ({ kind: "text", text });
export const editingChip = (key: TokenKey, value: string): EditingChip => ({
    kind: "chip",
    key,
    status: "editing",
    value,
});
export const closedChip = (key: TokenKey, selected: TokenValue): ClosedChip => ({
    kind: "chip",
    key,
    status: "closed",
    selected,
});

export const EMPTY: Line = { segments: [text("")], caret: 0 };

// A closed chip is one caret step; an editing chip spans its value, where the caret lives while it is open.
export const segmentLength = (segment: Segment): number =>
    segment.kind === "text" ? segment.text.length : segment.status === "closed" ? 1 : segment.value.length;

export const lineLength = (segments: Segment[]): number =>
    segments.reduce((sum, segment) => sum + segmentLength(segment), 0);

export const isEmpty = (segments: Segment[]): boolean =>
    segments.every((segment) => segment.kind === "text" && segment.text === "");

// Text and chips alternate, with text first and last, so every caret position belongs to a text segment or to
// the editing value, and the rendered line has a text node on both sides of every chip.
export function normalize(segments: Segment[]): Segment[] {
    const result: Segment[] = [];
    for (const segment of segments) {
        const last = result[result.length - 1];
        if (segment.kind === "text") {
            if (last?.kind === "text") result[result.length - 1] = text(last.text + segment.text);
            else result.push(segment);
        } else {
            if (last?.kind !== "text") result.push(text(""));
            result.push(segment);
        }
    }
    if (result[result.length - 1]?.kind !== "text") result.push(text(""));
    return result;
}

interface Placed<S extends Segment> {
    index: number;
    segment: S;
    start: number;
    end: number;
}

function placed(segments: Segment[]): Placed<Segment>[] {
    let start = 0;
    return segments.map((segment, index) => {
        const end = start + segmentLength(segment);
        const entry = { index, segment, start, end };
        start = end;
        return entry;
    });
}

export function editingAt(segments: Segment[]): Placed<EditingChip> | undefined {
    return placed(segments).find(
        (entry): entry is Placed<EditingChip> => entry.segment.kind === "chip" && entry.segment.status === "editing",
    );
}

export const editingValue = (segments: Segment[]): string | undefined => editingAt(segments)?.segment.value;

export const selectedValues = (segments: Segment[], key?: TokenKey): TokenValue[] =>
    segments.flatMap((segment) =>
        segment.kind === "chip" && segment.status === "closed" && (key === undefined || segment.key === key)
            ? [segment.selected]
            : [],
    );

export const queryText = (segments: Segment[]): string =>
    segments
        .flatMap((segment) => (segment.kind === "text" ? [segment.text] : []))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function locate(segments: Segment[], caret: number): Placed<TextSegment | EditingChip> {
    const editing = editingAt(segments);
    if (editing && caret >= editing.start && caret <= editing.end) return editing;
    const texts = placed(segments).filter((entry): entry is Placed<TextSegment> => entry.segment.kind === "text");
    return texts.find((entry) => caret >= entry.start && caret <= entry.end) ?? texts[texts.length - 1];
}

function replaceAt(segments: Segment[], index: number, ...replacement: Segment[]): Segment[] {
    return normalize([...segments.slice(0, index), ...replacement, ...segments.slice(index + 1)]);
}

export function insertText(line: Line, inserted: string): Line {
    const clean = inserted.replace(/[\r\n]+/g, " ");
    if (!clean) return line;
    const { index, segment, start } = locate(line.segments, line.caret);
    const offset = clamp(line.caret - start, 0, segmentLength(segment));
    const replaced: Segment =
        segment.kind === "text"
            ? text(segment.text.slice(0, offset) + clean + segment.text.slice(offset))
            : { ...segment, value: segment.value.slice(0, offset) + clean + segment.value.slice(offset) };
    return { segments: replaceAt(line.segments, index, replaced), caret: start + offset + clean.length };
}

// Only a bare key like `curso:` at a word start converts, and only when typed: 260 disciplina names contain "curso"
// and 88 contain ":", and the literal Escape hands back must keep reading as plain search while the user types on.
function keyBefore(before: string): TokenKey | undefined {
    return TOKEN_KEYS.find((key) => {
        const literal = `${key}:`;
        if (!before.toLowerCase().endsWith(literal)) return false;
        const start = before.length - literal.length;
        return start === 0 || /\s/.test(before[start - 1]);
    });
}

export function convertKey(line: Line): Line | null {
    const { index, segment, start } = locate(line.segments, line.caret);
    if (segment.kind !== "text") return null;
    const offset = line.caret - start;
    const key = keyBefore(segment.text.slice(0, offset));
    if (!key) return null;
    const keyStart = offset - key.length - 1;
    const segments = replaceAt(
        line.segments,
        index,
        text(segment.text.slice(0, keyStart)),
        editingChip(key, ""),
        text(segment.text.slice(offset)),
    );
    return { segments, caret: start + keyStart };
}

export function typeText(line: Line, typed: string): Line {
    const inserted = insertText(line, typed);
    return convertKey(inserted) ?? inserted;
}

export function deleteRange(line: Line, a: number, b: number): Line {
    const total = lineLength(line.segments);
    let from = clamp(Math.min(a, b), 0, total);
    let to = clamp(Math.max(a, b), 0, total);
    const editing = editingAt(line.segments);
    if (editing) {
        from = clamp(from, editing.start, editing.end);
        to = clamp(to, editing.start, editing.end);
        if (from === to) return { segments: line.segments, caret: from };
        const value =
            editing.segment.value.slice(0, from - editing.start) + editing.segment.value.slice(to - editing.start);
        return { segments: replaceAt(line.segments, editing.index, { ...editing.segment, value }), caret: from };
    }
    if (from === to) return { segments: line.segments, caret: from };
    const kept: Segment[] = [];
    for (const { segment, start, end } of placed(line.segments)) {
        if (segment.kind === "text") {
            const cutFrom = clamp(from, start, end) - start;
            const cutTo = clamp(to, start, end) - start;
            kept.push(text(segment.text.slice(0, cutFrom) + segment.text.slice(cutTo)));
        } else if (!(from <= start && end <= to)) {
            kept.push(segment);
        }
    }
    return { segments: normalize(kept), caret: from };
}

function removeSegment(line: Line, entry: Placed<Segment>): Line {
    return { segments: replaceAt(line.segments, entry.index), caret: entry.start };
}

// Right after a closed chip, Backspace reopens it with its name editable instead of deleting it; a second
// Backspace on an emptied value removes the chip.
export function deleteBackward(line: Line): Line {
    const editing = editingAt(line.segments);
    if (editing) {
        if (editing.segment.value === "") return removeSegment(line, editing);
        if (line.caret <= editing.start) return line;
        return deleteRange(line, line.caret - 1, line.caret);
    }
    const chip = placed(line.segments).find(
        (entry): entry is Placed<ClosedChip> =>
            entry.segment.kind === "chip" && entry.segment.status === "closed" && entry.end === line.caret,
    );
    if (chip) {
        const reopened = editingChip(chip.segment.key, chip.segment.selected.nome);
        return {
            segments: replaceAt(line.segments, chip.index, reopened),
            caret: chip.start + reopened.value.length,
        };
    }
    return deleteRange(line, line.caret - 1, line.caret);
}

export function deleteForward(line: Line): Line {
    return deleteRange(line, line.caret, line.caret + 1);
}

export function moveCaret(line: Line, delta: number): Line {
    const editing = editingAt(line.segments);
    const [min, max] = editing ? [editing.start, editing.end] : [0, lineLength(line.segments)];
    return { segments: line.segments, caret: clamp(line.caret + delta, min, max) };
}

// A chosen chip is followed by a space with the caret after it, so typing on never touches the chip.
export function closeChip(line: Line, selected: TokenValue): Line | null {
    const editing = editingAt(line.segments);
    if (!editing) return null;
    const after = line.segments[editing.index + 1];
    const spaced = after?.kind === "text" && /^\s/.test(after.text);
    const chip = closedChip(editing.segment.key, selected);
    const segments = spaced
        ? replaceAt(line.segments, editing.index, chip)
        : replaceAt(line.segments, editing.index, chip, text(" "));
    return { segments, caret: editing.start + 2 };
}

export function escapeChip(line: Line, at?: number): Line | null {
    const editing = editingAt(line.segments);
    if (!editing) return null;
    const literal = `${editing.segment.key}:${editing.segment.value}`;
    const target = at ?? editing.end;
    return {
        segments: replaceAt(line.segments, editing.index, text(literal)),
        caret: target < editing.start ? target : target + literal.length - editing.segment.value.length,
    };
}

// A suggestion stands for the free text that produced it, so the text goes and the chips already there stay.
export function applySuggestion(line: Line, key: TokenKey, selected: TokenValue): Line {
    const chips = line.segments.filter((segment) => segment.kind === "chip");
    const segments = normalize([...chips, closedChip(key, selected), text(" ")]);
    return { segments, caret: lineLength(segments) };
}

export function selectValue(line: Line, key: TokenKey, selected: TokenValue): Line {
    return closeChip(line, selected) ?? applySuggestion(line, key, selected);
}
