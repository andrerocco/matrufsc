import { type Accessor, batch, createEffect, createSignal, onCleanup, untrack } from "solid-js";

type ResourceState = "unresolved" | "pending" | "ready" | "refreshing" | "errored";

type MaybeSource<S> = S | false | null | undefined;

export type CachedResource<T, S> = Accessor<T | undefined> & {
    readonly state: ResourceState;
    readonly loading: boolean;
    readonly error: unknown;
    readonly latest: T | undefined;
    readonly source: S | undefined;
    readonly key: string | undefined;
};

type Fetcher<S, T> = (
    source: S,
    info: {
        value: T | undefined;
        cached: boolean;
        signal: AbortSignal;
    },
) => T | Promise<T>;

type Options<S> = {
    key?: (source: S) => string;
};

export function createCachedResource<S, T>(
    source: Accessor<MaybeSource<S>>,
    fetcher: Fetcher<S, T>,
    options: Options<S> = {},
): [
    CachedResource<T, S>,
    {
        refetch: () => Promise<T | undefined>;
        mutate: (value: T | undefined) => T | undefined;
    },
] {
    const keyOf = options.key ?? ((source: S) => JSON.stringify(source));

    const [value, setValue] = createSignal<T>();
    const [state, setState] = createSignal<ResourceState>("unresolved");
    const [error, setError] = createSignal<unknown>();
    const [currentSource, setCurrentSource] = createSignal<S>();
    const [currentKey, setCurrentKey] = createSignal<string>();

    let requestId = 0;
    let controller: AbortController | undefined;

    function readCache(key: string): { hit: true; value: T } | { hit: false } {
        if (typeof localStorage === "undefined") return { hit: false };

        try {
            const raw = localStorage.getItem(key);
            return raw == null ? { hit: false } : { hit: true, value: JSON.parse(raw) as T };
        } catch {
            return { hit: false };
        }
    }

    function writeCache(key: string, next: T | undefined) {
        if (typeof localStorage === "undefined") return;

        try {
            if (next === undefined) {
                localStorage.removeItem(key);
            } else {
                localStorage.setItem(key, JSON.stringify(next));
            }
        } catch {
            // Ignore quota/private-mode errors.
        }
    }

    async function load(nextSource: S | undefined, nextKey: string | undefined, readFromCache: boolean) {
        const id = ++requestId;

        controller?.abort();

        if (!nextSource || !nextKey) {
            batch(() => {
                setCurrentSource(undefined);
                setCurrentKey(undefined);
                setValue(undefined);
                setError(undefined);
                setState("unresolved");
            });

            return undefined;
        }

        batch(() => {
            setCurrentSource(() => nextSource);
            setCurrentKey(nextKey);
        });

        let visibleValue = untrack(value);
        let cached = visibleValue !== undefined;

        if (readFromCache) {
            const cache = readCache(nextKey);
            cached = cache.hit;
            visibleValue = cache.hit ? cache.value : undefined;

            batch(() => {
                setValue(() => visibleValue);
                setError(undefined);
                setState(cache.hit ? "refreshing" : "pending");
            });
        } else {
            batch(() => {
                setError(undefined);
                setState(cached ? "refreshing" : "pending");
            });
        }

        const aborter = new AbortController();
        controller = aborter;

        try {
            const next = await fetcher(nextSource, {
                value: visibleValue,
                cached,
                signal: aborter.signal,
            });

            if (id !== requestId || untrack(currentKey) !== nextKey) {
                return untrack(value);
            }

            writeCache(nextKey, next);

            batch(() => {
                setValue(() => next);
                setError(undefined);
                setState("ready");
            });

            return next;
        } catch (err) {
            if (id !== requestId || untrack(currentKey) !== nextKey || aborter.signal.aborted) {
                return untrack(value);
            }

            batch(() => {
                // Keep cached/previous value visible.
                setError(err);
                setState("errored");
            });

            return untrack(value);
        }
    }

    createEffect(() => {
        const nextSource = source();

        if (!nextSource) {
            void load(undefined, undefined, true);
            return;
        }

        const nextKey = keyOf(nextSource);
        void load(nextSource, nextKey, true);
    });

    onCleanup(() => {
        requestId++;
        controller?.abort();
    });

    const resource = (() => value()) as CachedResource<T, S>;

    Object.defineProperties(resource, {
        state: {
            get: () => state(),
        },
        loading: {
            get: () => {
                const s = state();
                return s === "pending" || s === "refreshing";
            },
        },
        error: {
            get: () => error(),
        },
        latest: {
            get: () => value(),
        },
        source: {
            get: () => currentSource(),
        },
        key: {
            get: () => currentKey(),
        },
    });

    function refetch() {
        return load(untrack(currentSource), untrack(currentKey), false);
    }

    function mutate(next: T | undefined) {
        const key = untrack(currentKey);

        if (key) {
            writeCache(key, next);
        }

        batch(() => {
            setValue(() => next);
            setError(undefined);
            setState(next === undefined ? "unresolved" : "ready");
        });

        return next;
    }

    return [resource, { refetch, mutate }];
}
