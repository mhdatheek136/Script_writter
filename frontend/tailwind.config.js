/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                'soft': {
                    'slate': '#64748b',
                    'navy': '#1e293b',
                    'teal': '#2dd4bf',
                    'beige': '#f5f5f4',
                    'border': 'rgba(0, 0, 0, 0.05)',
                    'border-dark': 'rgba(255, 255, 255, 0.06)',
                },
                'ui': {
                    'bg-light': '#f8fafc',
                    'bg-dark': '#050505',
                    'surface-light': '#ffffff',
                    'surface-dark': '#0f0f0f',
                }
            },
            fontFamily: {
                ans: ['Inter', 'Outfit', 'system-ui', 'sans-serif'],
            },
            transitionDuration: {
                'soft': '300ms',
            },
            boxShadow: {
                'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
                'soft-dark': '0 10px 40px -10px rgba(0, 0, 0, 0.8)',
            },
        },
    },
    plugins: [],
}
