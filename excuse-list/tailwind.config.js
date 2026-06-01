import daisyui from 'daisyui'

export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        primary: '#FF7A00', // WebUntis orange
        secondary: '#0055A4', // WebUntis blue (often used as secondary)
        accent: '#FACC15',
        neutral: '#F9FAFB', // very light gray
        'neutral-dark': '#1F2937',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        light: {
          ...require("daisyui/src/theming/themes")["light"],
          primary: "#FF7A00",
          secondary: "#0055A4",
          "base-100": "#ffffff",
          "base-200": "#f3f4f6",
        },
        dark: {
          ...require("daisyui/src/theming/themes")["dark"],
          primary: "#FF7A00",
          secondary: "#0055A4",
          "base-100": "#1f2937",
          "base-200": "#111827",
        },
      },
    ],
  },
}
