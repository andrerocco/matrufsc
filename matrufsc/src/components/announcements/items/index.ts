import type { JSX } from "solid-js";
import searchFilters from "./searchFilters";

export type Announcement = {
    // Reusing an `id` makes the new announcement never show for whoever saw the old one.
    id: string;
    date: string;
    title: string;
    text: () => JSX.Element;
    details: () => JSX.Element;
    illustration: () => JSX.Element;
};

export const ANNOUNCEMENTS: Announcement[] = [searchFilters];

export const formatDate = (date: string) =>
    new Date(`${date}T00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
