/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./src/**/*.{html,js,ts,jsx,tsx}"],
    theme: {
        extend: {
            keyframes: {
                "fade-in-left": {
                    "0%": { opacity: "0", transform: "translateX(-3px)" },
                    "100%": { opacity: "1", transform: "translateX(0)" },
                },
                "fade-out-left": {
                    "0%": { opacity: "1", transform: "translateX(0)" },
                    "100%": { opacity: "0", transform: "translateX(-3px)" },
                },
            },
            animation: {
                "fade-in-left": "fade-in-left 100ms ease-out",
                "fade-out-left": "fade-out-left 100ms ease-out",
            },
        },
    },
    plugins: [],
};
