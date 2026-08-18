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
        surface: {
          bg: "#F4F3EF",
          card: "#FFFFFF",
          sunken: "#F7F6F2",
          border: "#E7E4DA",
        },
        heading: "#26251C",
        body: "#57564A",
        muted: "#8B897A",
        brass: {
          DEFAULT: "#C99A3D",
          light: "#DBAE52",
          dark: "#A97F2E",
        },
        sidebar: {
          bg: "#22251F",
          border: "#34372E",
          text: "#B9B7A8",
          active: "#F3E7C9",
        },
        good: "#4F7A3D",
        danger: {
          text: "#B5432E",
          fill: "#B5432E",
          bg: "#FDEDE9",
          border: "#F3C9BE",
        },
        warn: {
          text: "#8A6A1E",
          bg: "#FBF3DC",
          border: "#EEDBA0",
        },
      },
      boxShadow: {
        soft: "0 2px 10px 0 rgba(38, 37, 28, 0.06)",
        "soft-md": "0 6px 20px 0 rgba(38, 37, 28, 0.08)",
        "soft-lg": "0 12px 32px 0 rgba(38, 37, 28, 0.12)",
      },
    },
  },
  plugins: [],
}

