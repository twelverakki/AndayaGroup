# Andaya ERP Web Design & Style Guide

Aesthetic guidelines to maintain a premium, clean, and modern look matching the boutique terracotta theme of Andaya ERP.

## 1. Typography & Font Weights
To prevent the interface from looking too heavy, amateurish, or cluttered:
- **Avoid Heavy Weights**: Do NOT use `font-black` (900) or `font-extrabold` (800) for standard content titles, table text, buttons, or form cards.
- **Header Weights**: Use `font-semibold` (600) for main page titles, card headers, and important labels.
- **Sub-headers & Labels**: Use `font-medium` (500) for table headings, secondary label text, and sub-headings.
- **Body & Description Text**: Use `font-normal` (400) or `font-medium` for descriptive text.

## 2. Page & Header Layouts
- **Baseline Headers**: The page header must always have a height of `h-16` to match the baseline of the sidebar switcher header exactly.
- **Shadows instead of Borders**: Avoid drawing bottom borders on the main page header bar. Instead, use a subtle fading shadow to separate it from the content:
  - Light mode: `shadow-[0_4px_12px_rgba(0,0,0,0.03)]`
  - Dark mode: `shadow-[0_4px_12px_rgba(0,0,0,0.15)]`
  - Include `z-10` to keep the shadow floating neatly above the scrollable workspace container.
- **Background Contrast**: Always follow the theme background:
  - Light mode: warm cream parchment (`bg-background` which resolves to `oklch(0.965 0.008 85)`)
  - Dark mode: deep warm chocolate-brown (`bg-background` which resolves to `oklch(0.16 0.01 60)`)
