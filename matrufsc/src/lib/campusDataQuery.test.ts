import { before, describe, test } from "node:test";
import assert from "node:assert";
import { campusDataQuery } from "./campusDataQuery";
import { makeCacheStorage } from "./makeCacheStorage";
import type { JSONCampus } from "~/data/schema";

const CURRENT: JSONCampus = {
    campus: "JOI",
    data_extracao: "15/11/26 - 03:00",
    cursos: { "208": "ENGENHARIA MECÂNICA" },
    disciplinas: [
        [
            "EMB5001",
            "Cálculo I",
            [["01208", 72, 50, 10, 0, 40, 0, ["2.1330-2 / CTC-CTC102"], ["Professor Um"], 208, null]],
        ],
    ],
};

// O formato publicado até a troca: disciplina com nome_ascii, turma sem curso nem status, arquivo sem cursos.
const BEFORE_THE_FORMAT_CHANGE = {
    campus: "JOI",
    data_extracao: "15/11/26 - 03:00",
    disciplinas: [
        [
            "EMB5001",
            "CALCULO I",
            "Cálculo I",
            [["01208", 72, 50, 10, 0, 40, 0, ["2.1330-2 / CTC-CTC102"], ["Professor Um"]]],
        ],
    ],
};

function fakeCacheStorage(): CacheStorage {
    const entries = new Map<string, string>();
    const cache = {
        match: async (url: string) => (entries.has(url) ? new Response(entries.get(url)) : undefined),
        put: async (url: string, response: Response) => void entries.set(url, await response.text()),
        delete: async (url: string) => entries.delete(url),
    };
    return { open: async () => cache } as unknown as CacheStorage;
}

describe("campusDataQuery cache", () => {
    const stored = makeCacheStorage({ cacheName: "test" });

    before(() => {
        globalThis.caches = fakeCacheStorage();
    });

    test("a cached file the parser cannot read counts as no cache", async () => {
        const source = { campus: "JOI", semester: "20262" } as const;
        const key = campusDataQuery.key(source);
        await stored.setItem(key, JSON.stringify(BEFORE_THE_FORMAT_CHANGE));

        assert.deepStrictEqual(await campusDataQuery.read(source), { hit: false, key });
    });

    test("a cached file in the current format is served", async () => {
        const source = { campus: "JOI", semester: "20271" } as const;
        const key = campusDataQuery.key(source);
        await stored.setItem(key, JSON.stringify(CURRENT));

        assert.deepStrictEqual(await campusDataQuery.read(source), { hit: true, key, value: CURRENT });
    });
});
