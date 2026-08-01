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

	/**
	 * Paste a clipboard block (TAB-separated cells, newline-separated rows)
	 * with its top-left at (row, col), as copied with its top-left at
	 * (originRow, originCol): every formula rebases by the single delta
	 * target−origin with fill semantics — unpinned references shift,
	 * `$`-pinned coordinates hold — literals land verbatim, empty block cells
	 * clear their targets, and every pasted line is data (a block has no
	 * comment or directive semantics). Passing the target as the origin pastes
	 * external text with no rebasing. Atomic: a malformed formula is an engine
	 * error naming its target cell and the source is unchanged.
	 */
	paste(source, row, col, originRow, originCol, block) {
		return this.#call("paste", source, row, col, originRow, originCol, block);
	}

	/**
	 * Paste a clipboard block over the inclusive target span. A span whose
	 * rows AND columns are exact multiples of the block's dimensions is TILED
	 * by the block — each tile rebased to its own position, exactly as
	 * separate pastes would be, so one copied row spread-pastes onto every
	 * selected row. Any other span places the block once at its top-left
	 * (paste semantics). Atomic across all tiles.
	 */
	pasteInto(source, loRow, loCol, hiRow, hiCol, originRow, originCol, block) {
		return this.#call(
			"pasteInto",
			source,
			loRow,
			loCol,
			hiRow,
			hiCol,
			originRow,
			originCol,
			block,
		);
	}

	/** Return the precedents and dependents of the cell at (row, col). */
	references(source, row, col) {
		return this.#call("references", source, row, col);
	}

	/**
	 * Replace the seed store a relative `IMPORT*` resolves against with the
	 * given name → tabular-text map (the page's `--data`; nothing inside a
	 * sheet can add to it or reach past it, and absolute URLs stay refused).
	 * Returns the sorted names now available.
	 */
	seedData(files) {
		return this.#call("seedData", files);
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
