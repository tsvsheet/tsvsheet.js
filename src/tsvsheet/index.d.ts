/**
 * TypeScript declarations for @tsvsheet/tsvsheet — the embedded-WebAssembly
 * tsvsheet engine. The shapes mirror the JSON the Go engine emits.
 */

/** A stable error code carried on {@link TsvsheetError.code}. */
export type Code = "load" | "engine";

/** The stable error codes, matched on {@link TsvsheetError.code}. */
export const CODES: Readonly<{ LOAD: "load"; ENGINE: "engine" }>;

/** An error raised while loading the engine or by an engine operation. */
export class TsvsheetError extends Error {
	readonly name: "TsvsheetError";
	readonly code: Code;
	constructor(code: Code, message?: string, cause?: unknown);
}

/** A grid of cell strings, indexed `grid[row][col]`. */
export type Grid = string[][];

/** A zero-based cell address. */
export interface Address {
	row: number;
	col: number;
}

/** A rectangular span of cells, from its top-left to its bottom-right. */
export interface Span {
	from: Address;
	to: Address;
}

/**
 * A document's totals, and the budget that decides how it opens. A document
 * whose `cells` exceed `budget` is view/compute-only and pages — the same
 * ruling, and the same ceiling, in every frontend (spec 021).
 */
export interface Census {
	rows: number;
	cols: number;
	cells: number;
	formulas: number;
	budget: number;
	isWindowed: boolean;
}

/** One static diagnostic reported by `compute`. */
/**
 * One declaration's rows and columns, as sorted 1-based positions — the
 * numbering a reader sees in the gutter, not a 0-based index. A host renders
 * these directly; the engine has already resolved every `count(…)` and
 * from-the-end offset against the sheet's own extent.
 */
export interface Axes {
	rows: number[];
	cols: number[];
}

export interface Diagnostic {
	cell: string;
	message: string;
	fatal: boolean;
}

/** One input a traced cell read. */
export interface TraceInput {
	ref: string;
	value: string;
}

/** An explanation of how a cell was produced. */
export interface Trace {
	cell: string;
	value: string;
	formula?: string;
	inputs?: TraceInput[];
}

/** The render model returned by every computing/editing operation. */
export interface View {
	computed: Grid;
	source: Grid;
	/**
	 * The canonical `.tsvt` source text after the operation — comment and
	 * shebang lines preserved in position, every line newline-terminated. The
	 * one sanctioned serialization: persist this, never rebuild text from a
	 * grid.
	 */
	text: string;
	/** Static diagnostics, or `null` when there are none. */
	diagnostics: Diagnostic[] | null;
	/** Rows and columns the sheet's `#.hide` directives keep out of sight. */
	hidden: Axes;
	/** Rows and columns declared as headers with `#.header`. */
	headers: Axes;
	/** Rows and columns `#.freeze` pins while the rest scrolls. */
	frozen: Axes;
	volatile: boolean;
	/** One cadence spec per volatile(…) call — Go durations ("250ms") or isnow
	 * patterns — so a page can recompute at the soonest cadence the sheet asks
	 * for rather than a flat interval. `null` for a static sheet (and for a
	 * volatile sheet whose calls name no cadence). */
	schedules: string[] | null;
}

/** The precedents and dependents of a cell (`null` when there are none). */
export interface References {
	precedents: Span[] | null;
	dependents: Address[] | null;
}

/**
 * The typed facade over the embedded engine. Every method takes the `.tsvt`
 * source string the caller holds; the engine is stateless.
 */
export class Engine {
	compute(source: string): View;
	/**
	 * A source's totals from one scan, materializing nothing — the pre-flight
	 * that decides whether a document is edited whole or paged (spec 021).
	 */
	census(source: string): Census;
	/** One viewport's source texts, clipped to the grid; nothing computed. */
	windowRows(source: string, from: number, n: number): Grid;
	/** One viewport evaluated under the browser's budgets. */
	windowComputed(source: string, from: number, n: number): Grid;
	setCell(source: string, row: number, col: number, text: string): View;
	insertRow(source: string, row: number, col: number): View;
	deleteRow(source: string, row: number, col: number): View;
	insertCol(source: string, row: number, col: number): View;
	deleteCol(source: string, row: number, col: number): View;
	duplicateRow(source: string, row: number, col: number): View;
	duplicateCol(source: string, row: number, col: number): View;
	fill(
		source: string,
		fromRow: number,
		fromCol: number,
		loRow: number,
		loCol: number,
		hiRow: number,
		hiCol: number,
	): View;
	paste(
		source: string,
		row: number,
		col: number,
		originRow: number,
		originCol: number,
		block: string,
	): View;
	pasteInto(
		source: string,
		loRow: number,
		loCol: number,
		hiRow: number,
		hiCol: number,
		originRow: number,
		originCol: number,
		block: string,
	): View;
	references(source: string, row: number, col: number): References;
	seedData(files: Record<string, string>): string[];
	explain(source: string, row: number, col: number): Trace;
}

/** Read `tsvsheet.wasm` + `wasm_exec.js` beside this module and instantiate. */
export function load(): Promise<Engine>;

/** Instantiate the engine from caller-supplied `tsvsheet.wasm` bytes. */
export function loadFrom(bytes: BufferSource): Promise<Engine>;
