import { makePersisted } from "@solid-primitives/storage";
import { createSignal } from "solid-js";

export const persistedSignal =
    <T>(name: string) =>
    (init: T | undefined) => {
        const [value, setValue] = makePersisted(createSignal(init), { name });
        return [value, setValue] as [typeof value, typeof setValue];
    };
