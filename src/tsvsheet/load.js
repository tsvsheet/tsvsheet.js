/**
 * load — instantiate the embedded WebAssembly engine and hand back a ready
 * {@link Engine}. The Go engine is shipped as two build artifacts beside this
 * module: `tsvsheet.wasm` (the engine) and `wasm_exec.js` (Go's runtime glue,
 * a classic script that assigns `globalThis.Go`). Both are read relative to
 * this module so the package works unpacked in Node and served in the browser.
 *
 * In Node the assets are read from disk (fs + file URL); in the browser they
 * are fetched. `wasm_exec.js` is not an ES module, so it is read as text and
 * evaluated in a function scope to recover the `Go` constructor. `go.run` is
 * NOT awaited: the Go program installs the global `tsvsheet` object and then
 * blocks forever, so the object is available synchronously once `run` starts.
 *
 * The reader seams (`readText`/`readBytes`) take an explicit `node` flag so
 * both the disk and fetch paths are exercisable; production code omits it and
 * lets the module-level environment detection decide.
 */
import { CODES, TsvsheetError } from "./errors.js";
import { Engine } from "./engine.js";

const inNode =
	typeof process !== "undefined" && process.versions?.node !== undefined;

/** Resolve an asset that sits beside this module. */
const assetURL = (name) => new URL(name, import.meta.url);

/** Read a sibling asset from disk as raw bytes (Node only). */
async function nodeRead(name) {
	const { readFile } = await import("node:fs/promises");
	return readFile(assetURL(name));
}

/** Fetch a sibling asset as UTF-8 text (browser). */
async function fetchText(name) {
	return (await fetch(assetURL(name))).text();
}

/** Fetch a sibling asset as an ArrayBuffer (browser). */
async function fetchArrayBuffer(name) {
	return (await fetch(assetURL(name))).arrayBuffer();
}

/** Read a sibling asset as UTF-8 text (Node: fs; browser: fetch). */
export async function readText(name, node = inNode) {
	return node ? (await nodeRead(name)).toString("utf8") : fetchText(name);
}

/** Read a sibling asset as raw bytes (Node: fs; browser: fetch). */
export async function readBytes(name, node = inNode) {
	return new Uint8Array(node ? await nodeRead(name) : await fetchArrayBuffer(name));
}

/**
 * Evaluate the `wasm_exec.js` source (a classic script assigning
 * `globalThis.Go`) and recover the `Go` constructor. The source is the
 * version-pinned Go build artifact shipped in this package, not caller input.
 */
export function defineGo(source) {
	const factory = new Function(`${source}\nreturn globalThis.Go;`);
	const Go = factory();
	if (typeof Go !== "function") {
		throw new TsvsheetError(CODES.LOAD, "wasm_exec.js did not define Go");
	}
	return Go;
}

/** Wrap the global `tsvsheet` object the Go program installs, or fail. */
export function pickEngine() {
	if (globalThis.tsvsheet === undefined) {
		throw new TsvsheetError(CODES.LOAD, "wasm did not export tsvsheet");
	}
	return new Engine(globalThis.tsvsheet);
}

/**
 * Instantiate `bytes` against a Go runtime, start it, and return the Engine
 * wrapping the global `tsvsheet` object the program installs.
 */
async function instantiate(bytes, Go) {
	const go = new Go();
	const result = await WebAssembly.instantiate(bytes, go.importObject).catch(
		(cause) => {
			throw new TsvsheetError(
				CODES.LOAD,
				"failed to instantiate tsvsheet.wasm",
				cause,
			);
		},
	);
	go.run(result.instance); // starts the engine; intentionally not awaited
	return pickEngine();
}

/**
 * Instantiate the engine from caller-supplied wasm `bytes`. When the page has
 * already defined `globalThis.Go` (a classic `<script src="wasm_exec.js">`,
 * the CSP-strict route — `new Function` is an eval sink that
 * `default-src 'self'` blocks), that runtime is used directly; otherwise
 * `wasm_exec.js` is read from beside this module and evaluated.
 * @param {BufferSource} bytes the `tsvsheet.wasm` module bytes
 * @returns {Promise<Engine>}
 */
export async function loadFrom(bytes) {
	const Go = typeof globalThis.Go === "function"
		? globalThis.Go
		: defineGo(await readText("wasm_exec.js"));
	return instantiate(bytes, Go);
}

/**
 * Read `tsvsheet.wasm` + `wasm_exec.js` from beside this module and return a
 * ready {@link Engine}.
 * @returns {Promise<Engine>}
 */
export async function load() {
	return loadFrom(await readBytes("tsvsheet.wasm"));
}
