/**
 * A1 addressing as text, exposed as its own subpath so a bundler can take the
 * labels without the package entry's asset loading (the Obsidian plugin
 * instantiates the engine from bytes it reads itself, and pulling `load.js`
 * into that bundle would carry `node:fs` into a browser context).
 */

/**
 * The A1 column label for a zero-based index: 0 → A, 25 → Z, 26 → AA.
 * Bijective base-26, matching the addresses formulas use.
 */
export function colLetter(index: number): string;

/** The A1 row label for a zero-based index: 0 → "1". */
export function rowLabel(index: number): string;
