import type { Component } from "solid-js";
import type { LucideProps } from "lucide-solid";
import GripVertical from "lucide-solid/icons/grip-vertical";
import X from "lucide-solid/icons/x";

// Import icons only through here, so lucide can be swapped for standalone SVGs in this file alone.
const icon = (Icon: Component<LucideProps>) => (props: { class?: string }) => (
    <Icon size="1.25em" strokeWidth={1.75} class={props.class} aria-hidden="true" />
);

export const IconClose = icon(X);
export const IconGrip = icon(GripVertical);
