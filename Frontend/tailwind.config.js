/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sidebar: {
          DEFAULT: "var(--sidebar)",
          hover: "var(--sidebar-hover)",
          active: "var(--sidebar-active)",
          text: "var(--sidebar-text)",
          label: "var(--sidebar-label)",
        },
        bg: "var(--bg)",
        surface: "var(--surface)",
        line: "var(--line)",
        "row-line": "var(--row-line)",
        band: "var(--band)",
        "input-border": "var(--input-border)",
        ink: {
          DEFAULT: "var(--ink)",
          2: "var(--ink-2)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
        },
        overdue: "var(--overdue)",
        grace: {
          DEFAULT: "var(--grace-marker)",
          text: "var(--grace-text)",
          marker: "var(--grace-marker)",
        },
        expiring: {
          DEFAULT: "var(--expiring-marker)",
          text: "var(--expiring-text)",
          marker: "var(--expiring-marker)",
        },
        paid: "var(--paid)",
      },
      fontFamily: {
        sans: ['"Hanken Grotesk"', "system-ui", "-apple-system", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm: "4px",
        "btn-sm": "6px",
        panel: "6px",
        input: "8px",
        btn: "8px",
        DEFAULT: "6px",
      },
      spacing: {
        sidebar: "236px",
      },
      letterSpacing: {
        "header-cap": "0.08em",
      },
    },
  },
  plugins: [],
};

