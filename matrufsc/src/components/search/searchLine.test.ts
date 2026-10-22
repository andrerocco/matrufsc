import { describe, test } from "node:test";
import assert from "node:assert";
import {
    EMPTY,
    applySuggestion,
    closeChip,
    closedChip,
    convertKey,
    deleteBackward,
    deleteForward,
    deleteRange,
    editingChip,
    editingValue,
    escapeChip,
    insertText,
    isEmpty,
    lineLength,
    moveCaret,
    normalize,
    queryText,
    selectValue,
    selectedValues,
    text,
    typeText,
    type Line,
    type Segment,
} from "~/components/search/searchLine";

const FARMACIA = { id: "102", nome: "FARMÁCIA" };
const SOCIAIS = { id: "310", nome: "CIÊNCIAS SOCIAIS" };
const farmacia = closedChip("curso", FARMACIA);
const sociais = closedChip("curso", SOCIAIS);
const editing = (value: string) => editingChip("curso", value);

const line = (parts: (string | Segment)[], caret?: number): Line => {
    const segments = normalize(parts.map((part) => (typeof part === "string" ? text(part) : part)));
    return { segments, caret: caret ?? lineLength(segments) };
};

const typeEach = (start: Line, typed: string) => [...typed].reduce((current, char) => typeText(current, char), start);

describe("search line", () => {
    describe("normalize", () => {
        test("merges adjacent text and keeps a text segment on both sides of every chip", () => {
            assert.deepStrictEqual(normalize([text("a"), text("b")]), [text("ab")]);
            assert.deepStrictEqual(normalize([farmacia]), [text(""), farmacia, text("")]);
            assert.deepStrictEqual(normalize([farmacia, sociais]), [text(""), farmacia, text(""), sociais, text("")]);
            assert.deepStrictEqual(normalize([]), [text("")]);
        });

        test("a closed chip is one caret step, an editing chip spans its value", () => {
            assert.strictEqual(lineLength(line(["ab", farmacia, "cd"]).segments), 5);
            assert.strictEqual(lineLength(line(["ab", editing("far"), "cd"]).segments), 7);
            assert.ok(isEmpty(EMPTY.segments));
            assert.ok(!isEmpty(line([farmacia]).segments));
        });
    });

    describe("typing `curso:`", () => {
        test("at the end converts into an empty chip in editing state", () => {
            assert.deepStrictEqual(typeEach(EMPTY, "curso:"), line(["", editing(""), ""], 0));
            assert.deepStrictEqual(typeEach(EMPTY, "Curso:"), line(["", editing(""), ""], 0));
        });

        test("at the start of existing text converts and keeps the text after the chip", () => {
            assert.deepStrictEqual(typeEach(line(["calculo"], 0), "curso:"), line(["", editing(""), "calculo"], 0));
        });

        test("in the middle converts at the caret", () => {
            assert.deepStrictEqual(typeEach(line(["calculo I"], 8), "curso:"), line(["calculo ", editing(""), "I"], 8));
        });

        test("adds another chip beside a closed one instead of replacing it", () => {
            const start = line(["", farmacia, " "]);
            assert.deepStrictEqual(typeEach(start, "curso:"), line(["", farmacia, " ", editing(""), ""], 2));
        });

        test("only converts at a word start, so names containing the word keep searching as text", () => {
            assert.deepStrictEqual(typeEach(EMPTY, "concurso:"), line(["concurso:"]));
            assert.deepStrictEqual(typeEach(EMPTY, "cursos:"), line(["cursos:"]));
            assert.deepStrictEqual(
                typeEach(EMPTY, "trabalho de conclusao de curso: x"),
                line(["trabalho de conclusao de ", editing(" x"), ""]),
            );
        });

        test("while a chip is editing, everything typed belongs to its value, spaces and `curso:` included", () => {
            const open = typeEach(EMPTY, "curso:");
            assert.deepStrictEqual(typeEach(open, "ciencias sociais"), line(["", editing("ciencias sociais"), ""], 16));
            assert.deepStrictEqual(typeEach(open, "curso:"), line(["", editing("curso:"), ""], 6));
            assert.strictEqual(editingValue(typeEach(open, "far").segments), "far");
        });

        test("pasting `curso:` is plain text; conversion needs the key to be typed", () => {
            assert.deepStrictEqual(insertText(EMPTY, "curso:"), line(["curso:"]));
            assert.strictEqual(convertKey(insertText(EMPTY, "curso:x")), null);
        });
    });

    describe("insertText (paste)", () => {
        const chips = line(["", farmacia, "", sociais, ""]);

        test("inserts before, between and after chips, moving the caret past the text", () => {
            assert.deepStrictEqual(
                insertText({ ...chips, caret: 0 }, "abc"),
                line(["abc", farmacia, "", sociais, ""], 3),
            );
            assert.deepStrictEqual(
                insertText({ ...chips, caret: 1 }, "abc"),
                line(["", farmacia, "abc", sociais, ""], 4),
            );
            assert.deepStrictEqual(
                insertText({ ...chips, caret: 2 }, "abc"),
                line(["", farmacia, "", sociais, "abc"], 5),
            );
        });

        test("inserts inside existing text", () => {
            assert.deepStrictEqual(insertText(line(["calculo I"], 7), " de"), line(["calculo de I"], 10));
        });

        test("keeps the line single: line breaks become spaces", () => {
            assert.deepStrictEqual(insertText(EMPTY, "a\nb\r\nc"), line(["a b c"]));
            assert.deepStrictEqual(insertText(EMPTY, ""), EMPTY);
        });

        test("goes into the value while a chip is editing", () => {
            assert.deepStrictEqual(
                insertText(line(["", editing("fa"), "x"], 2), "rm"),
                line(["", editing("farm"), "x"], 4),
            );
        });
    });

    describe("queryText and selectedValues", () => {
        test("concatenates the free text around the chips with single spaces", () => {
            assert.strictEqual(queryText(line(["calculo ", farmacia, " I"]).segments), "calculo I");
            assert.strictEqual(queryText(line(["calculo", farmacia, "I"]).segments), "calculo I");
            assert.strictEqual(queryText(line(["  calculo   ", farmacia, "", sociais, "  I  "]).segments), "calculo I");
            assert.strictEqual(queryText(line(["", farmacia, ""]).segments), "");
            assert.strictEqual(queryText(EMPTY.segments), "");
        });

        test("lists the closed chips in order and ignores an editing one", () => {
            assert.deepStrictEqual(selectedValues(line(["a", sociais, "b", editing("x"), farmacia]).segments), [
                SOCIAIS,
                FARMACIA,
            ]);
            assert.deepStrictEqual(selectedValues(EMPTY.segments), []);
        });
    });

    describe("deleteBackward", () => {
        test("right after a closed chip reopens that chip with its name as the value", () => {
            const reopened = deleteBackward(line(["calculo ", farmacia, " I"], 9));
            assert.deepStrictEqual(reopened, line(["calculo ", editing("FARMÁCIA"), " I"], 16));
            assert.deepStrictEqual(deleteBackward(line(["", farmacia, ""], 1)), line(["", editing("FARMÁCIA"), ""], 8));
        });

        test("reopens only the chip right before the caret when there are several", () => {
            const two = line(["", farmacia, "", sociais, ""]);
            assert.deepStrictEqual(
                deleteBackward({ ...two, caret: 1 }),
                line(["", editing("FARMÁCIA"), "", sociais, ""], 8),
            );
            assert.deepStrictEqual(
                deleteBackward({ ...two, caret: 2 }),
                line(["", farmacia, "", editing("CIÊNCIAS SOCIAIS"), ""], 17),
            );
        });

        test("in an editing chip with an empty value removes the chip", () => {
            assert.deepStrictEqual(deleteBackward(line(["calculo ", editing(""), "I"], 8)), line(["calculo I"], 8));
            assert.deepStrictEqual(deleteBackward(line(["", editing(""), ""], 0)), EMPTY);
        });

        test("in an editing chip with a value deletes from the value, and stops at its start", () => {
            assert.deepStrictEqual(
                deleteBackward(line(["x", editing("far"), ""], 4)),
                line(["x", editing("fa"), ""], 3),
            );
            assert.deepStrictEqual(
                deleteBackward(line(["x", editing("far"), ""], 1)),
                line(["x", editing("far"), ""], 1),
            );
        });

        test("elsewhere deletes one character", () => {
            assert.deepStrictEqual(deleteBackward(line(["ab", farmacia, "cd"], 4)), line(["ab", farmacia, "d"], 3));
            assert.deepStrictEqual(deleteBackward(line(["ab", farmacia, "cd"], 2)), line(["a", farmacia, "cd"], 1));
            assert.deepStrictEqual(deleteBackward(line(["ab"], 0)), line(["ab"], 0));
        });

        test("reopen then Escape hands the literal back in place, keeping the text around it", () => {
            const reopened = deleteBackward(line(["calculo ", farmacia, " I"], 9));
            assert.deepStrictEqual(escapeChip(reopened), line(["calculo curso:FARMÁCIA I"], 22));
        });

        test("reopen then picking another curso closes it again in place", () => {
            const reopened = deleteBackward(line(["calculo ", farmacia, " I"], 9));
            assert.deepStrictEqual(closeChip(reopened, SOCIAIS), line(["calculo ", sociais, " I"], 10));
        });
    });

    describe("deleteForward", () => {
        test("right before a closed chip removes the chip whole", () => {
            assert.deepStrictEqual(deleteForward(line(["ab", farmacia, "cd"], 2)), line(["abcd"], 2));
        });

        test("elsewhere deletes one character, and nothing at the end", () => {
            assert.deepStrictEqual(deleteForward(line(["ab", farmacia, "cd"], 3)), line(["ab", farmacia, "d"], 3));
            assert.deepStrictEqual(deleteForward(line(["ab"], 2)), line(["ab"], 2));
        });

        test("inside an editing value deletes from the value and stops at its end", () => {
            assert.deepStrictEqual(
                deleteForward(line(["", editing("far"), "x"], 0)),
                line(["", editing("ar"), "x"], 0),
            );
            assert.deepStrictEqual(
                deleteForward(line(["", editing("far"), "x"], 3)),
                line(["", editing("far"), "x"], 3),
            );
        });
    });

    describe("deleteRange", () => {
        const start = line(["abc", farmacia, "def"]);

        test("removes text and the chips fully inside the range", () => {
            assert.deepStrictEqual(deleteRange(start, 1, 6), line(["af"], 1));
            assert.deepStrictEqual(deleteRange(start, 6, 1), line(["af"], 1));
            assert.deepStrictEqual(deleteRange(start, 0, 7), EMPTY);
        });

        test("leaves a chip at the edge of the range alone", () => {
            assert.deepStrictEqual(deleteRange(start, 1, 3), line(["a", farmacia, "def"], 1));
            assert.deepStrictEqual(deleteRange(start, 4, 6), line(["abc", farmacia, "f"], 4));
        });

        test("only moves the caret for an empty range", () => {
            assert.deepStrictEqual(deleteRange(start, 5, 5), { segments: start.segments, caret: 5 });
        });

        test("stays inside the value while a chip is editing", () => {
            const open = line(["ab", editing("farm"), "cd"], 6);
            assert.deepStrictEqual(deleteRange(open, 0, 4), line(["ab", editing("rm"), "cd"], 2));
            assert.deepStrictEqual(deleteRange(open, 3, 8), line(["ab", editing("f"), "cd"], 3));
        });
    });

    describe("moveCaret", () => {
        test("crosses a closed chip as one unit and stops at the ends", () => {
            const start = line(["ab", farmacia, "cd"], 2);
            assert.strictEqual(moveCaret(start, 1).caret, 3);
            assert.strictEqual(moveCaret(moveCaret(start, 1), -1).caret, 2);
            assert.strictEqual(moveCaret(line(["ab", farmacia, "cd"], 0), -1).caret, 0);
            assert.strictEqual(moveCaret(line(["ab", farmacia, "cd"], 5), 1).caret, 5);
            assert.strictEqual(moveCaret(start, 1).segments, start.segments);
        });

        test("stays inside the value while a chip is editing", () => {
            const open = line(["ab", editing("far"), "cd"], 5);
            assert.strictEqual(moveCaret(open, 1).caret, 5);
            assert.strictEqual(moveCaret(open, -1).caret, 4);
            assert.strictEqual(moveCaret({ ...open, caret: 2 }, -1).caret, 2);
        });
    });

    describe("closeChip", () => {
        test("closes the editing chip in place, adds a space and puts the caret after it", () => {
            assert.deepStrictEqual(
                closeChip(line(["calculo ", editing("farm"), "I"], 12), FARMACIA),
                line(["calculo ", farmacia, " I"], 10),
            );
            assert.deepStrictEqual(closeChip(line(["", editing(""), ""], 0), FARMACIA), line(["", farmacia, " "], 2));
        });

        test("reuses a space the text after the chip already starts with", () => {
            assert.deepStrictEqual(
                closeChip(line(["calculo ", editing("farm"), " I"], 12), FARMACIA),
                line(["calculo ", farmacia, " I"], 10),
            );
        });

        test("does nothing without an editing chip", () => {
            assert.strictEqual(closeChip(line(["", farmacia, "x"]), SOCIAIS), null);
            assert.strictEqual(closeChip(EMPTY, SOCIAIS), null);
        });
    });

    describe("escapeChip", () => {
        test("turns the editing chip into the literal text at its position, caret after it", () => {
            assert.deepStrictEqual(escapeChip(line(["", editing(""), ""], 0)), line(["curso:"]));
            assert.deepStrictEqual(escapeChip(line(["a ", editing("farm"), " b"], 6)), line(["a curso:farm b"], 12));
        });

        test("with a target position, keeps it fixed before the chip and shifts it after", () => {
            const open = line(["ab", editing("farm"), "cd"], 6);
            assert.strictEqual(escapeChip(open, 1)!.caret, 1);
            assert.strictEqual(escapeChip(open, 7)!.caret, 13);
            assert.strictEqual(escapeChip(open, 2)!.caret, 8);
        });

        test("the restored literal keeps reading as plain text on the next keystroke", () => {
            const restored = escapeChip(line(["", editing(""), ""], 0))!;
            assert.deepStrictEqual(typeText(restored, "f"), line(["curso:f"]));
            assert.deepStrictEqual(typeText(restored, " "), line(["curso: "]));
        });

        test("is not handled without an editing chip", () => {
            assert.strictEqual(escapeChip(EMPTY), null);
            assert.strictEqual(escapeChip(line(["", farmacia, "x"])), null);
        });
    });

    describe("suggestions", () => {
        test("a suggestion replaces the whole free text with a closed chip and keeps the chips already there", () => {
            assert.deepStrictEqual(
                applySuggestion(line(["farmacia"]), "curso", FARMACIA),
                line(["", farmacia, " "], 2),
            );
            assert.deepStrictEqual(
                applySuggestion(line(["", farmacia, " cien"]), "curso", SOCIAIS),
                line(["", farmacia, "", sociais, " "], 3),
            );
        });

        test("selectValue closes the editing chip when there is one, and applies a suggestion otherwise", () => {
            assert.deepStrictEqual(
                selectValue(line(["x", editing("far"), "y"], 4), "curso", FARMACIA),
                line(["x", farmacia, " y"], 3),
            );
            assert.deepStrictEqual(selectValue(line(["farm"]), "curso", FARMACIA), line(["", farmacia, " "], 2));
        });
    });
});
