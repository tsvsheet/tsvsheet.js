/**
 * Engine — the typed JavaScript facade over the embedded WebAssembly engine.
 *
 * The Go engine (compiled to `tsvsheet.wasm`) publishes a global `tsvsheet`
 * object of STATELESS functions, each taking the `.tsvt` source as its first
 * argument and returning a JSON string. Engine wraps that object: every method
 * parses the JSON result and surfaces an engine-reported `{error}` as a typed
 * {@link TsvsheetError}. The caller holds the source; no state lives here.
 */
import { CODES, TsvsheetError } from "./errors.js";

export class Engine {
	#api;

	/** @param {Record<string, (...args: unknown[]) => string>} api the global `tsvsheet` object */
	constructor(api) {
		this.#api = api;
	}

	/** Parse and compute `source`, returning the full view. */
	compute(source) {
		return this.#call("compute", source);
	}

	/** Replace the cell at (row, col) with `text` and recompute. */
	setCell(source, row, col, text) {
		return this.#call("setCell", source, row, col, text);
	}

	/** Insert a blank row before `row` and recompute. */
	insertRow(source, row, col) {
		return this.#call("insertRow", source, row, col);
	}

	/** Delete `row` and recompute. */
	deleteRow(source, row, col) {
		return this.#call("deleteRow", source, row, col);
	}

	/** Insert a blank column before `col` and recompute. */
	insertCol(source, row, col) {
		return this.#call("insertCol", source, row, col);
	}

	/** Delete `col` and recompute. */
	deleteCol(source, row, col) {
		return this.#call("deleteCol", source, row, col);
	}

	/**
	 * Duplicate `row` below itself and recompute: the duplicate's references
	 * rebase one row down (`$`-pinned coordinates hold) and the rest of the
	 * grid shifts as an insert shifts it.
	 */
	duplicateRow(source, row, col) {
		return this.#call("duplicateRow", source, row, col);
	}

	/** Duplicate `col` to its right and recompute (references rebase as above). */
	duplicateCol(source, row, col) {
		return this.#call("duplicateCol", source, row, col);
	}

	/**
	 * Copy the cell at (fromRow, fromCol) into every cell of the inclusive
	 * target span with fill semantics — unpinned references shift by each
	 * target's offset, `$`-pinned coordinates hold — and recompute.
	 */
	fill(source, fromRow, fromCol, loRow, loCol, hiRow, hiCol) {
		return this.#call(
			"fill",
			source,
			fromRow,
			fromCol,
			loRow,
			loCol,
			hiRow,
			hiCol,
		);
	}

	/** Return the precedents and dependents of the cell at (row, col). */
	references(source, row, col) {
		return this.#call("references", source, row, col);
	}

	/** Trace how the cell at (row, col) was produced. */
	explain(source, row, col) {
		return this.#call("explain", source, row, col);
	}

	/**
	 * Invoke a named wasm function, parse its JSON result, and raise a typed
	 * error when the engine reports one.
	 */
	#call(name, ...args) {
		const parsed = JSON.parse(this.#api[name](...args));
		if (parsed !== null && parsed.error !== undefined) {
			throw new TsvsheetError(CODES.ENGINE, parsed.error);
		}
		return parsed;
	}
}
