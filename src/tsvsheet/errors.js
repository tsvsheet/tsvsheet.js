/**
 * The error contract for @uplang/tsvsheet. Two stable codes cover the two
 * failure surfaces a caller sees: `load` when the WebAssembly engine cannot be
 * fetched or instantiated, and `engine` when a loaded engine rejects a call
 * (a `.tsvt` syntax error, an out-of-range edit). Callers match on `err.code`.
 */
export const CODES = Object.freeze({
	LOAD: "load",
	ENGINE: "engine",
});

/** TsvsheetError carries one of the stable {@link CODES} in `.code`. */
export class TsvsheetError extends Error {
	/**
	 * @param {string} code one of {@link CODES}
	 * @param {string} [message] human-readable detail
	 * @param {unknown} [cause] the underlying failure, when there is one
	 */
	constructor(code, message, cause) {
		super(message ?? code, cause === undefined ? undefined : { cause });
		this.name = "TsvsheetError";
		this.code = code;
	}
}
