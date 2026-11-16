import { describe, test } from "node:test";
import assert from "node:assert";
import {
    EMPTY,
    closeChip,
    closedChip,
    deleteBackward,
    deleteForward,
    deleteRange,
    editingChip,
    escapeChip,
    insertText,
    isEmpty,
    leaveChip,
    lineLength,
    moveCaret,
    normalize,
    queryText,
    reopenChip,
    restoreChip,
    selectValue,
    selectedValues,
    text,
    typeText,
    type Line,
    type Segment,
} from "./searchLine";

const FARMACIA = { id: "102", nome: "FARMÁCIA" };
const SOCIAIS = { id: "310", nome: "CIÊNCIAS SOCIAIS" };
const farmacia = closedChip("curso", FARMACIA);
const sociais = closedChip("curso", SOCIAIS);
const editing = (value: string) => editingChip("curso", value);
const reopened = (value: string) => editingChip("curso", value, FARMACIA);

const line = (parts: (string | Segment)[], caret?: number): Line => {
    const segments = normalize(parts.map((part) => (typeof part === "string" ? text(part) : part)));
    return { segments, caret: caret ?? lineLength(segments) };
};

const typeEach = (start: Line, typed: string) => [...typed].reduce((current, char) => typeText(current, char), start);

describe("search line", () => {
    test("text and chips alternate, with text on both sides of every chip", () => {
        assert.deepStrictEqual(normalize([text("a"), text("b")]), [text("ab")]);
        assert.deepStrictEqual(normalize([farmacia, sociais]), [text(""), farmacia, text(""), sociais, text("")]);
        assert.deepStrictEqual(normalize([]), [text("")]);
    });

    test("a closed chip is one caret step, an editing chip spans its value", () => {
        assert.strictEqual(lineLength(line(["ab", farmacia, "cd"]).segments), 5);
        assert.strictEqual(lineLength(line(["ab", editing("far"), "cd"]).segments), 7);
        assert.ok(isEmpty(EMPTY.segments));
        assert.ok(!isEmpty(line(["a"]).segments) && !isEmpty(line([farmacia]).segments));
    });

    describe("typing a key", () => {
        test("`curso:` at a word start opens an empty chip there", () => {
            assert.deepStrictEqual(typeEach(EMPTY, "Curso:"), line(["", editing(""), ""], 0));
            assert.deepStrictEqual(typeEach(line(["calculo I"], 8), "curso:"), line(["calculo ", editing(""), "I"], 8));
            assert.deepStrictEqual(
                typeEach(line(["", farmacia, " "]), "professor:"),
                line(["", farmacia, " ", editingChip("professor", ""), ""], 2),
            );
        });

        test("inside a word it stays text, so names that contain the key keep searching", () => {
            assert.deepStrictEqual(typeEach(EMPTY, "concurso:"), line(["concurso:"]));
            assert.deepStrictEqual(typeEach(EMPTY, "cursos:"), line(["cursos:"]));
        });

        test("while a chip is open, everything typed goes into its value", () => {
            assert.deepStrictEqual(
                typeEach(line(["", editing(""), ""], 0), "curso: x"),
                line(["", editing("curso: x"), ""], 8),
            );
        });

        test("pasted text never opens a chip, and line breaks become spaces", () => {
            assert.deepStrictEqual(insertText(EMPTY, "curso:"), line(["curso:"]));
            assert.deepStrictEqual(
                insertText(line(["", farmacia, "", sociais, ""], 1), "a\r\nb"),
                line(["", farmacia, "a b", sociais, ""], 4),
            );
            assert.deepStrictEqual(insertText(line(["ab", farmacia, "cd"], 1), "x"), line(["axb", farmacia, "cd"], 2));
            assert.deepStrictEqual(
                insertText(line(["", editing("fm"), "x"], 1), "ar"),
                line(["", editing("farm"), "x"], 3),
            );
            assert.strictEqual(insertText(EMPTY, ""), EMPTY);
        });
    });

    test("the query is the text around the chips, and the filters are the closed chips", () => {
        const segments = line(["  calculo   ", farmacia, "", editing("x"), "  I  ", sociais]).segments;
        assert.strictEqual(queryText(segments), "calculo I");
        assert.deepStrictEqual(selectedValues(segments), [FARMACIA, SOCIAIS]);
        assert.deepStrictEqual(
            selectedValues(line(["", farmacia, "", closedChip("professor", SOCIAIS)]).segments, "professor"),
            [SOCIAIS],
        );
    });

    describe("Backspace", () => {
        test("right after a closed chip reopens that chip with its name as the value", () => {
            const two = line(["x", farmacia, "", sociais, " I"]);
            assert.deepStrictEqual(
                deleteBackward({ ...two, caret: 2 }),
                line(["x", reopened("FARMÁCIA"), "", sociais, " I"], 9),
            );
        });

        test("on an emptied chip or at the start of a value removes the chip, and inside a value deletes", () => {
            assert.deepStrictEqual(deleteBackward(line(["calculo ", editing(""), "I"], 8)), line(["calculo I"], 8));
            assert.deepStrictEqual(
                deleteBackward(line(["x", editing("far"), ""], 4)),
                line(["x", editing("fa"), ""], 3),
            );
            assert.deepStrictEqual(deleteBackward(line(["x", editing("far"), "y"], 1)), line(["xy"], 1));
        });

        test("elsewhere deletes one character", () => {
            assert.deepStrictEqual(deleteBackward(line(["ab", farmacia, "cd"], 4)), line(["ab", farmacia, "d"], 3));
            assert.deepStrictEqual(deleteBackward(line(["ab"], 0)), line(["ab"], 0));
        });
    });

    describe("Delete", () => {
        test("right before a closed chip removes it whole", () => {
            assert.deepStrictEqual(deleteForward(line(["ab", farmacia, "cd"], 2)), line(["abcd"], 2));
        });

        test("inside a value stops at its end", () => {
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

    describe("deleting a selection", () => {
        const start = line(["abc", farmacia, "def"]);

        test("removes the text and the chips fully inside it, in either direction", () => {
            assert.deepStrictEqual(deleteRange(start, 6, 1), line(["af"], 1));
            assert.deepStrictEqual(deleteRange(start, 1, 3), line(["a", farmacia, "def"], 1));
            assert.deepStrictEqual(deleteRange(start, 5, 5), { segments: start.segments, caret: 5 });
        });

        test("stays inside the value while a chip is open", () => {
            const open = line(["ab", editing("farm"), "cd"]);
            assert.deepStrictEqual(deleteRange(open, 0, 4), line(["ab", editing("rm"), "cd"], 2));
            assert.deepStrictEqual(deleteRange(open, 3, 8), line(["ab", editing("f"), "cd"], 3));
        });
    });

    test("the arrows cross a closed chip as one step and stay inside an open one", () => {
        assert.strictEqual(moveCaret(line(["ab", farmacia, "cd"], 2), 1).caret, 3);
        assert.strictEqual(moveCaret(line(["ab", farmacia, "cd"], 5), 1).caret, 5);
        assert.strictEqual(moveCaret(line(["ab", editing("far"), "cd"], 5), 1).caret, 5);
        assert.strictEqual(moveCaret(line(["ab", editing("far"), "cd"], 2), -1).caret, 2);
    });

    describe("closing a chip", () => {
        test("leaves a space after it and the caret past the space", () => {
            assert.deepStrictEqual(
                closeChip(line(["calculo ", editing("farm"), "I"], 12), FARMACIA),
                line(["calculo ", farmacia, " I"], 10),
            );
            assert.deepStrictEqual(
                closeChip(line(["calculo ", editing("farm"), " I"], 12), FARMACIA),
                line(["calculo ", farmacia, " I"], 10),
            );
            assert.strictEqual(closeChip(line(["", farmacia, "x"]), SOCIAIS), null);
        });

        test("when the caret left it, the caret lands where it was aimed", () => {
            const open = line(["ab", editing("farm"), "cd"], 6);
            assert.deepStrictEqual(leaveChip(open, FARMACIA, 2), line(["ab", farmacia, " cd"], 2));
            assert.deepStrictEqual(leaveChip(open, FARMACIA, 4), line(["ab", farmacia, " cd"], 3));
            assert.deepStrictEqual(leaveChip(open, FARMACIA, 7), line(["ab", farmacia, " cd"], 5));
            assert.deepStrictEqual(
                leaveChip(line(["ab", editing("farm"), " cd"], 6), FARMACIA, 8),
                line(["ab", farmacia, " cd"], 5),
            );
        });

        test("a value that names nothing is handed back as the literal text", () => {
            const open = line(["ab", editing("farm"), "cd"], 6);
            assert.deepStrictEqual(leaveChip(open, undefined, 7), line(["abcurso:farmcd"], 13));
            assert.deepStrictEqual(escapeChip(open), line(["abcurso:farmcd"], 12));
            assert.strictEqual(escapeChip(open, 1)!.caret, 1);
            assert.strictEqual(escapeChip(open, 2)!.caret, 8);
            assert.strictEqual(escapeChip(EMPTY), null);
        });

        test("the literal handed back keeps reading as plain text on the next keystroke", () => {
            assert.deepStrictEqual(typeText(escapeChip(line(["", editing(""), ""], 0))!, "f"), line(["curso:f"]));
        });
    });

    describe("a reopened chip", () => {
        const closed = line(["ab", farmacia, "cd"]);

        test("opens with the caret at the offset within its name", () => {
            assert.deepStrictEqual(reopenChip(closed, 2, 3), line(["ab", reopened("FARMÁCIA"), "cd"], 5));
            assert.deepStrictEqual(reopenChip(closed, 2, 99), line(["ab", reopened("FARMÁCIA"), "cd"], 10));
            assert.strictEqual(reopenChip(closed, 1), null);
        });

        test("left with its name intact is the chip it was", () => {
            const open = reopenChip(closed, 2, 3)!;
            assert.deepStrictEqual(restoreChip(open), line(["ab", farmacia, " cd"], 3));
            assert.strictEqual(restoreChip(deleteBackward(open)), null);
            assert.strictEqual(restoreChip(line(["", editing("FARMÁCIA"), ""])), null);
        });
    });

    test("picking a value closes the open chip, or stands for the free text that suggested it", () => {
        assert.deepStrictEqual(
            selectValue(line(["x", editing("far"), "y"], 4), "curso", FARMACIA),
            line(["x", farmacia, " y"], 3),
        );
        assert.deepStrictEqual(
            selectValue(line(["", farmacia, " cien"]), "curso", SOCIAIS),
            line(["", farmacia, " ", sociais, " "], 4),
        );
    });
});
