import { createCachedQuery } from "~/lib/createCachedResource";
import type { JSONCampus, JSONCampusCode } from "./types";

async function fetchCampusData(source: { semester: string; campus: JSONCampusCode }): Promise<JSONCampus> {
    const { semester, campus } = source;
    const ano = semester.slice(0, 4);

    try {
        const resp = await fetch(`${import.meta.env.BASE_URL}data/${ano}/${semester}-${campus}.json`);
        if (!resp.ok) throw new Error(`Failed to load campus data: ${resp.status} ${resp.statusText}`);
        return await resp.json();
    } catch (error) {
        console.error("Error fetching campus data:", error);
        throw error;
    }
}

export const campusDataQuery = createCachedQuery(fetchCampusData, {
    key: (source) => `matrufsc:campusData:${source.campus}_${source.semester}`,
});
