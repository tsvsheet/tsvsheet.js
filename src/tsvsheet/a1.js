/**
 * A1 addressing, as text. The language names a column by letters and a row by
 * a 1-based number; a grid that shows those labels is showing the addresses a
 * formula would use, so the naming has to be the language's rather than each
 * frontend's own idea of it.
 *
 * It lives here — in the package every JS frontend already depends on —
 * because it was about to be written a third time. The engine owns the
 * semantics; this is the same naming in JS so a header row costs no wasm call.
 */

/**
 * The column label for a zero-based index: 0 → A, 25 → Z, 26 → AA. This is
 * bijective base-26 (there is no zero digit), which is why the loop subtracts
 * one before taking the remainder.
 *
 * @param {number} index zero-based column index
 * @returns {string} the A1 column label
 */
export function colLetter(index) {
	let letters = "";
	for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
		letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
	}
	return letters;
}

/**
 * The row label for a zero-based index: 0 → "1". Trivial, and exported beside
 * its column counterpart so a caller labelling a grid does not hand-roll the
 * off-by-one on only one axis.
 *
 * @param {number} index zero-based row index
 * @returns {string} the A1 row label
 */
export function rowLabel(index) {
	return String(index + 1);
}
