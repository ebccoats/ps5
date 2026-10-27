# Bat in a Cave

Browser-based game that uses haptics and audio to guide your exploration of a dark, underground cave.

## Compiling & running the project

The game source is TypeScript in `src-js/` and compiles to browser-ready JavaScript in `dist-js/`.  To compile:
1. Install TypeScript: `npm install -g typescript`.
2. Build with `tsc` (which uses `tsconfig.json`) or press **Shift+Command+B** in VS Code (which uses `.vscode/tasks.json` to call `tsc`).

To run the project:
- Open `index.html` in a browser, and connect your PS5 controller via the instructions on the page.

## Compiling & running the tests

To compile the project, compile the tests, and then run the tests:
```
tsc && tsc --ignoreConfig --rootDir tests --outDir tests tests/tests.ts && node tests/tests.js
```

(Running these tests uses `package.json`.)