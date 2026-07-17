/**
 * @uplang/tsvsheet — a spreadsheet for plain text, in the browser and Node.
 *
 * This package does NOT reimplement the tsvsheet engine in JavaScript: it
 * EMBEDS the Go engine compiled to WebAssembly (`tsvsheet.wasm`) and exposes a
 * thin typed facade over it. {@link load} instantiates the engine once and
 * returns an {@link Engine} of stateless operations over a `.tsvt` source
 * string — compute, edit a cell, insert/delete rows and columns, trace
 * references, and explain a cell. The `<tsv-sheet>` custom element (imported
 * from `@uplang/tsvsheet/tsv-sheet`) renders a live grid over the same engine.
 */
export { CODES, TsvsheetError } from "./errors.js";
export { Engine } from "./engine.js";
export { load, loadFrom } from "./load.js";
