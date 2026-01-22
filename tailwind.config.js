/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'bg-primary': '#1a1a1a',
                'bg-secondary': '#252525',
                'bg-tertiary': '#2d2d2d',
                'accent-primary': '#ff6b35',
                'accent-secondary': '#4a90e2',
                'text-primary': '#ffffff',
                'text-secondary': '#b4b4b4',
                'text-tertiary': '#808080',
            }
        },
    },
    plugins: [],
}
