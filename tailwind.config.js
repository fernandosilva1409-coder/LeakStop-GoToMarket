/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./pages/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Space Grotesk", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      colors: {
        ink: {
          bg: "#1B1D19",
          panel: "#22251F",
          border: "#34372E",
          border2: "#3A3D34",
        },
        paper: "#EFEAE0",
        muted: "#9C9A8C",
        faint: "#8B8A7D",
        brass: {
          DEFAULT: "#C99A3D",
          light: "#DBAE52",
        },
        good: "#8FA37F",
        danger: {
          text: "#D9765F",
          fill: "#B5432E",
          bg: "#2E211D",
          border: "#4A2E26",
        },
        warn: {
          text: "#D9C186",
          bg: "#2E2A1D",
          border: "#4A3F26",
        },
      },
    },
  },
  plugins: [],
}

