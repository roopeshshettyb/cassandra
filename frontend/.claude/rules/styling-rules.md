# Styling

- Take all styling from the theme only: colours, shadows and borders from `src/theme` (`NAVY`, `MUTED`, `BORDER`, `STATUS_*`, ...). No hex or rgba literals in components.
- Use MUI `sx`. Reuse `components/cards/AppCards.js` and `components/DetailShell.js` before building new UI.
- Everything must be responsive: MUI breakpoints (`{ xs, md }`) and `isMobile`.
