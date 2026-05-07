import type { AsyncStorage } from "@solid-primitives/storage";

export type CacheStorageOptions = {
    cacheName: string;
    baseUrl?: string | URL;
    scope?: string;
    responseInit?: ResponseInit;
};

const DEFAULT_SCOPE = "/__cache_storage__/";
const DEFAULT_RESPONSE_INIT: ResponseInit = {
    headers: {
        "content-type": "text/plain;charset=UTF-8",
    },
};

export function makeCacheStorage(options: CacheStorageOptions): AsyncStorage {
    const { cacheName } = options;
    const responseInit = options.responseInit ?? DEFAULT_RESPONSE_INIT;

    async function openCache(): Promise<Cache | undefined> {
        if (typeof caches === "undefined") return undefined;

        try {
            return await caches.open(cacheName);
        } catch {
            return undefined;
        }
    }

    return {
        async getItem(key) {
            const cache = await openCache();
            if (!cache) return null;

            const response = await cache.match(toRequestUrl(key, options));
            return response ? await response.text() : null;
        },
        async setItem(key, value) {
            const cache = await openCache();
            if (!cache) return;

            await cache.put(toRequestUrl(key, options), new Response(value, responseInit));
        },
        async removeItem(key) {
            const cache = await openCache();
            if (!cache) return;

            await cache.delete(toRequestUrl(key, options));
        },
    };
}

function toRequestUrl(key: string, options: CacheStorageOptions): string {
    const scope = options.scope ?? DEFAULT_SCOPE;
    const scopeUrl = new URL(ensureTrailingSlash(scope), getBaseUrl(options.baseUrl));
    return new URL(encodeURIComponent(key), scopeUrl).href;
}

function getBaseUrl(baseUrl: string | URL | undefined): string | URL {
    if (baseUrl) return baseUrl;
    if (typeof location !== "undefined") return location.origin;
    return "http://localhost";
}

function ensureTrailingSlash(value: string): string {
    return value.endsWith("/") ? value : `${value}/`;
}
