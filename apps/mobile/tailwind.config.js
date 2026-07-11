/**
 * Design tokens from docs/04-ui-ux-design-brief.md §2 — "The counter".
 * These are the ONLY colours, sizes and fonts in the app.
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    colors: {
      transparent: "transparent",
      enamel: "#0F3A32",
      "enamel-deep": "#082621",
      brass: "#C8912F",
      "brass-tint": "#F3E4C4",
      paper: "#FBFAF6",
      ruled: "#E3E2DA",
      ink: "#1B1D1A",
      "ink-soft": "#6A6E67",
      fresh: "#2E7D4F",
      chilli: "#C0392B",
      turmeric: "#E0A93B",
    },
    // Deliberately larger than a typical app (brief §2.2).
    fontSize: {
      display: ["34px", { lineHeight: "40px" }],
      h1: ["26px", { lineHeight: "32px" }],
      h2: ["21px", { lineHeight: "28px" }],
      "body-lg": ["18px", { lineHeight: "26px" }],
      body: ["16px", { lineHeight: "24px" }],
      caption: ["14px", { lineHeight: "20px" }],
      price: ["20px", { lineHeight: "24px" }],
      "price-lg": ["30px", { lineHeight: "34px" }],
    },
    // Anek superfamily (matching metrics across scripts) + IBM Plex Mono numerals.
    fontFamily: {
      anek: ["AnekKannada_400Regular"],
      "anek-medium": ["AnekKannada_500Medium"],
      "anek-semibold": ["AnekKannada_600SemiBold"],
      deva: ["AnekDevanagari_400Regular"],
      "deva-semibold": ["AnekDevanagari_600SemiBold"],
      mono: ["IBMPlexMono_500Medium"],
    },
    extend: {
      spacing: {
        gutter: "20px",
      },
      borderRadius: {
        card: "14px",
        button: "12px",
        chip: "999px",
        sheet: "24px",
      },
      boxShadow: {
        counter: "0 2px 8px rgba(15,58,50,0.08)",
      },
    },
  },
  plugins: [],
};
