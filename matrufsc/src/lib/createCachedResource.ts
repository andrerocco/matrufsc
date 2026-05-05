import { type Accessor, batch, createEffect, createSignal, onCleanup, untrack } from "solid-js";

type ResourceState = "unresolved" | "pending" | "ready" | "refreshing" | "errored";

type MaybeSource<S> = S | false | null | undefined;

export type CachedResource<T, S> = Accessor<T | undefined> & {
    /**
     * Resource status lifecycle:
     * - `unresolved`: no source/key is available; resource has no value.
     * - `pending`: a fetch is in-flight and no previous value is visible (first load).
     * - `refreshing`: a fetch is in-flight while a cached/previous value is visible.
     * - `ready`: the latest fetch resolved successfully; the resource holds the newest value.
     * - `errored`: the most recent fetch failed.
     */
    readonly state: ResourceState;
    /**
     * Equivalent to `state === 'pending' || state === 'refreshing'`.
     */
    readonly loading: boolean;
    /**
     * The last error produced by a failing fetch (set when `state === 'errored'`), or `undefined`.
     */
    readonly error: unknown;
    /**
     * The currently visible value. This is the same value returned by calling the accessor
     * itself (i.e. invoking the resource) and is `undefined` when unresolved.
     */
    readonly latest: T | undefined;
    /**
     * The current source object driving the resource (the input returned by the `source` accessor),
     * or `undefined` when the resource is `unresolved`.
     */
    readonly source: S | undefined;
    /**
     * The cache key computed by `query.key(source)` for the current `source`, or `undefined` when the
     * resource is `unresolved`.
     */
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

type CacheResult<T> = { hit: true; key: string; value: T } | { hit: false; key: string };

export type CachedQuery<S, T> = {
    key: (source: S) => string;
    read: (source: S) => CacheResult<T>;
    write: (source: S, value: T | undefined) => void;
    fetch: (source: S, info?: { value?: T; cached?: boolean }) => Promise<T>;
    get: (source: S) => Promise<T>;
};

/**
 * Creates a cached fetcher. Reusing the same query avoids fetching the same key twice.
 *
 * @example
 * const campusDataQuery = createCachedQuery(fetchCampusData, {
 *     key: (source) => `matrufsc:campusData:${source.campus}_${source.semester}`,
 * });
 */
export function createCachedQuery<S, T>(fetcher: Fetcher<S, T>, options: Options<S> = {}): CachedQuery<S, T> {
    const keyOf = options.key ?? ((source: S) => JSON.stringify(source));
    const memory = new Map<string, T>();
    const inFlight = new Map<string, Promise<T>>();

    function readKey(key: string): { hit: true; value: T } | { hit: false } {
        if (memory.has(key)) return { hit: true, value: memory.get(key) as T };
        if (typeof localStorage === "undefined") return { hit: false };

        try {
            const raw = localStorage.getItem(key);
            if (raw == null) return { hit: false };

            const value = JSON.parse(raw) as T;
            memory.set(key, value);
            return { hit: true, value };
        } catch {
            return { hit: false };
        }
    }

    function writeKey(key: string, next: T | undefined) {
        if (next === undefined) {
            memory.delete(key);
        } else {
            memory.set(key, next);
        }

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

    function read(source: S): CacheResult<T> {
        const key = keyOf(source);
        const cache = readKey(key);
        return cache.hit ? { ...cache, key } : { hit: false, key };
    }

    function write(source: S, next: T | undefined) {
        writeKey(keyOf(source), next);
    }

    function fetchSource(source: S, info: { value?: T; cached?: boolean } = {}) {
        const key = keyOf(source);
        const pending = inFlight.get(key);
        if (pending) return pending;

        const controller = new AbortController();
        const request = (async () => {
            const next = await fetcher(source, {
                value: info.value,
                cached: info.cached ?? info.value !== undefined,
                signal: controller.signal,
            });

            writeKey(key, next);
            return next;
        })().finally(() => {
            inFlight.delete(key);
        });

        inFlight.set(key, request);
        return request;
    }

    async function get(source: S) {
        const cache = read(source);
        return cache.hit ? cache.value : fetchSource(source);
    }

    return {
        key: keyOf,
        read,
        write,
        fetch: fetchSource,
        get,
    };
}

/**
 * Creates a Solid resource from a cached query.
 *
 * @example
 * const [campusData, { refetch }] = createCachedResource(
 *     () => semester() && campus() && { semester: semester()!, campus: campus()! },
 *     campusDataQuery,
 * );
 */
export function createCachedResource<S, T>(
    source: Accessor<MaybeSource<S>>,
    query: CachedQuery<S, T>,
): [
    CachedResource<T, S>,
    {
        refetch: () => Promise<T | undefined>;
        mutate: (value: T | undefined) => T | undefined;
    },
] {
    const [value, setValue] = createSignal<T>();
    const [state, setState] = createSignal<ResourceState>("unresolved");
    const [error, setError] = createSignal<unknown>();
    const [currentSource, setCurrentSource] = createSignal<S>();
    const [currentKey, setCurrentKey] = createSignal<string>();

    let requestId = 0;

    async function load(nextSource: S | undefined, nextKey: string | undefined, readFromCache: boolean) {
        const id = ++requestId;

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
            const cache = query.read(nextSource);
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

        try {
            const next = await query.fetch(nextSource, {
                value: visibleValue,
                cached,
            });

            if (id !== requestId || untrack(currentKey) !== nextKey) {
                return untrack(value);
            }

            batch(() => {
                setValue(() => next);
                setError(undefined);
                setState("ready");
            });

            return next;
        } catch (err) {
            if (id !== requestId || untrack(currentKey) !== nextKey) {
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

        const nextKey = query.key(nextSource);
        void load(nextSource, nextKey, true);
    });

    onCleanup(() => {
        requestId++;
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
        const source = untrack(currentSource);

        if (source) {
            query.write(source, next);
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
