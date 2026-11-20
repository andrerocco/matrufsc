import { editingAt, normalize, segmentLength, text, type Chip, type Segment } from "./searchLine";

// A zero-width space stands in for empty text, so the caret always has a text node to sit in next to a chip.
const ANCHOR = "\u200B";
const stripAnchors = (s: string) => s.replaceAll(ANCHOR, "");

// The key keeps the look of the text it was typed as, so nothing moves when `curso:` turns into a chip; only
// the value is tinted, while it is typed and once chosen, the way GitHub's search qualifiers read.
export const VALUE_CLASS = "rounded bg-blue-50 px-0.5 text-blue-600";

export interface Point {
    node: Node;
    offset: number;
}

export function renderLine(el: HTMLElement, segments: Segment[]): void {
    el.replaceChildren(
        ...segments.map((segment, index) =>
            segment.kind === "text" ? document.createTextNode(segment.text || ANCHOR) : renderChip(segment, index),
        ),
    );
}

function renderChip(chip: Chip, index: number): HTMLElement {
    const span = document.createElement("span");
    span.dataset.chip = String(index);
    span.draggable = false;
    const label = document.createElement("span");
    label.contentEditable = "false";
    label.textContent = `${chip.key}:`;
    const value = document.createElement("span");
    value.className = VALUE_CLASS;
    if (chip.status === "closed") {
        span.contentEditable = "false";
        value.textContent = chip.selected.nome;
    } else {
        value.textContent = chip.value || ANCHOR;
    }
    span.append(label, value);
    return span;
}

const isText = (node: Node): node is Text => node.nodeType === Node.TEXT_NODE;
const isElement = (node: Node): node is HTMLElement => node.nodeType === Node.ELEMENT_NODE;
const isEditable = (node: Node) => !(isElement(node) && node.contentEditable === "false");

export interface Reading {
    segments: Segment[];
    positions: number[];
}

// Reads the DOM back into segments: chips come from the segments they were rendered from, anything else is
// text. Each point (a selection end, a target range end) comes back as a caret position in those segments.
export function readLine(el: HTMLElement, rendered: Segment[], points: Point[]): Reading {
    const segments: Segment[] = [];
    const positions = points.map(() => -1);
    let position = 0;

    const markAt = (node: Node, offsetToPosition: (offset: number) => number) => {
        points.forEach((point, i) => {
            if (point.node !== node) return;
            const resolved = offsetToPosition(point.offset);
            if (resolved >= 0) positions[i] = resolved;
        });
    };
    const markWithin = (root: Node, value: number) => {
        points.forEach((point, i) => {
            if (positions[i] < 0 && root.contains(point.node)) positions[i] = value;
        });
    };
    const markChildren = (node: Node, read: (child: Node, index: number) => void) => {
        node.childNodes.forEach((child, index) => {
            markAt(node, (offset) => (offset === index ? position : -1));
            read(child, index);
        });
        markAt(node, (offset) => (offset >= node.childNodes.length ? position : -1));
    };
    // Walks a node's text, advancing `position`; a point in a text node resolves by its offset, a point on an
    // element by the child it precedes.
    const walk = (node: Node): string => {
        if (isText(node)) {
            markAt(node, (offset) => position + stripAnchors(node.data.slice(0, offset)).length);
            const content = stripAnchors(node.data);
            position += content.length;
            return content;
        }
        let content = "";
        markChildren(node, (child) => {
            content += walk(child);
        });
        return content;
    };

    markChildren(el, (child) => {
        const chip = isElement(child) && child.dataset.chip !== undefined ? rendered[Number(child.dataset.chip)] : null;
        if (chip?.kind !== "chip") {
            segments.push(text(walk(child)));
        } else if (chip.status === "closed") {
            markWithin(child, position);
            segments.push(chip);
            position += 1;
        } else {
            const start = position;
            let value = "";
            markChildren(child, (part) => {
                if (isEditable(part)) value += walk(part);
                else markWithin(part, start);
            });
            markWithin(child, start);
            segments.push({ ...chip, value });
        }
    });

    return { segments: normalize(segments), positions: positions.map((p) => (p < 0 ? position : p)) };
}

function caretPoint(el: HTMLElement, segments: Segment[], caret: number): Point | undefined {
    const editing = editingAt(segments);
    const inEditing = editing !== undefined && caret >= editing.start && caret <= editing.end;
    let start = 0;
    for (let index = 0; index < segments.length; index++) {
        const segment = segments[index];
        const node = el.childNodes[index];
        const end = start + segmentLength(segment);
        if (node && caret >= start && caret <= end) {
            if (inEditing && index === editing.index && node.lastChild) {
                return textPoint(node.lastChild.firstChild ?? node.lastChild, caret - start);
            }
            if (segment.kind === "text" && !inEditing) return textPoint(node, caret - start);
        }
        start = end;
    }
    return undefined;
}

const textPoint = (node: Node, offset: number): Point => ({
    node,
    offset: isText(node) && node.data !== ANCHOR ? Math.min(offset, node.length) : 0,
});

const SCROLL_MARGIN = 4;

export function placeCaret(el: HTMLElement, segments: Segment[], caret: number): void {
    const point = caretPoint(el, segments, caret);
    const selection = document.getSelection();
    if (!point || !selection) return;
    selection.collapse(point.node, point.offset);

    const rect = selection.getRangeAt(0).getBoundingClientRect();
    const box = el.getBoundingClientRect();
    if (rect.height === 0) return;
    if (rect.right > box.right - SCROLL_MARGIN) el.scrollLeft += rect.right - (box.right - SCROLL_MARGIN);
    else if (rect.left < box.left + SCROLL_MARGIN) el.scrollLeft -= box.left + SCROLL_MARGIN - rect.left;
}

export function selectionPoints(el: HTMLElement): Point[] {
    const selection = document.getSelection();
    if (!selection?.anchorNode || !selection.focusNode || !el.contains(selection.anchorNode)) return [];
    return [
        { node: selection.anchorNode, offset: selection.anchorOffset },
        { node: selection.focusNode, offset: selection.focusOffset },
    ];
}

export function rangePoints(range: StaticRange): Point[] {
    return [
        { node: range.startContainer, offset: range.startOffset },
        { node: range.endContainer, offset: range.endOffset },
    ];
}
