const KEY = "matrufsc:appLink";

// The plan lives in the app's link. A page opened from the app remembers that link for the tab, so the way
// back keeps the plan even after going through another page.
export function appLink() {
    const home = new URL(import.meta.env.BASE_URL, location.href).href;
    try {
        if (document.referrer.split("?")[0] === home) sessionStorage.setItem(KEY, document.referrer);
        return sessionStorage.getItem(KEY) ?? home;
    } catch {
        return home;
    }
}
