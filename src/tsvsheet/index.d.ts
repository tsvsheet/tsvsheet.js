/**
 * TypeScript declarations for @uplang/tsvsheet — the embedded-WebAssembly
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

/** One static diagnostic reported by `compute`. */
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
	/** Static diagnostics, or `null` when there are none. */
	diagnostics: Diagnostic[] | null;
	volatile: boolean;
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
	setCell(source: string, row: number, col: number, text: string): View;
	insertRow(source: string, row: number, col: number): View;
	deleteRow(source: string, row: number, col: number): View;
	insertCol(source: string, row: number, col: number): View;
	deleteCol(source: string, row: number, col: number): View;
	references(source: string, row: number, col: number): References;
	explain(source: string, row: number, col: number): Trace;
}

/** Read `tsvsheet.wasm` + `wasm_exec.js` beside this module and instantiate. */
export function load(): Promise<Engine>;

/** Instantiate the engine from caller-supplied `tsvsheet.wasm` bytes. */
export function loadFrom(bytes: BufferSource): Promise<Engine>;
