/**
 * Bundles @uplang/tsvsheet for the browser playground: the <tsv-sheet> web
 * component (which pulls in the typed API and the wasm loader) is bundled to a
 * single self-contained ESM file, and the two Go build artifacts the engine
 * needs at runtime — tsvsheet.wasm and wasm_exec.js — are copied beside it so
 * the loader can fetch them relative to the bundle. No CDN, no network beyond
 * the co-located assets.
 *
 * Run with `node playground/build.mjs` (or `npm run playground`).
 */

import { copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../src/tsvsheet");

await build({
	entryPoints: [resolve(src, "tsv-sheet.js")],
	outfile: resolve(here, "tsvsheet.bundle.js"),
	bundle: true,
	format: "esm",
	platform: "browser",
	target: "es2022",
	minify: true,
	sourcemap: false,
	legalComments: "none",
	// The Node-only disk reader is behind a runtime guard; keep its import out
	// of the browser bundle.
	external: ["node:fs/promises"],
	logLevel: "info",
});

for (const asset of ["tsvsheet.wasm", "wasm_exec.js"]) {
	await copyFile(resolve(src, asset), resolve(here, asset));
}
