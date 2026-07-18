/**
 * <tsv-sheet> — a framework-free custom element that renders a `.tsvt`
 * spreadsheet as a live HTML table over the embedded engine.
 *
 * The source comes from a `source` attribute, a `src` attribute (fetched), or
 * the element's text content. The element loads the engine once (shared across
 * all instances), computes the grid, and re-renders on each cell edit
 * (contenteditable cells → setCell → recompute). A volatile sheet — one whose
 * formulas read the clock (TODAY/NOW/ISNOW) — is recomputed on a slow interval
 * against the browser clock. The DOM helpers below are pure and testable; the
 * element class is a thin shell over them.
 */
import { load } from "./load.js";

/** Build one editable table cell carrying its zero-based coordinates. */
function cell(doc, value, row, col) {
	const td = doc.createElement("td");
	td.textContent = value;
	td.contentEditable = "true";
	td.dataset.row = String(row);
	td.dataset.col = String(col);
	return td;
}

/** Build a `<table>` of editable cells from a computed grid. */
export function buildTable(doc, grid) {
	const table = doc.createElement("table");
	grid.forEach((row, r) => {
		const tr = doc.createElement("tr");
		row.forEach((value, c) => tr.appendChild(cell(doc, value, r, c)));
		table.appendChild(tr);
	});
	return table;
}

/** Resolve an element's `.tsvt` source: `source` attr, `src` fetch, or text. */
export async function readSource(el) {
	const attr = el.getAttribute("source");
	if (attr !== null) {
		return attr;
	}
	const src = el.getAttribute("src");
	if (src !== null) {
		return (await fetch(src)).text();
	}
	return el.textContent.trim();
}

/** The shared engine promise — instantiated once, reused by every element. */
let pending;

/** Load the engine once and reuse the promise across instances. */
export function sharedEngine() {
	if (pending === undefined) {
		pending = load();
	}
	return pending;
}

export class TsvSheet extends HTMLElement {
	/** Engine provider, overridable in tests. Defaults to the shared loader. */
	static loader = sharedEngine;

	#engine;
	#source = "";
	#timer;
	#volatile = false;
	#boundRefresh;

	constructor() {
		super();
		this.refreshMs = 15000;
		this.#boundRefresh = this.refresh.bind(this);
	}

	connectedCallback() {
		this.ready = this.#init();
	}

	disconnectedCallback() {
		if (this.#timer !== undefined) {
			globalThis.clearInterval(this.#timer);
		}
		this.#timer = undefined;
	}

	/** Recompute against the current clock and re-render (volatile refresh). */
	refresh() {
		if (this.#engine === undefined) {
			return;
		}
		this.#apply(this.#engine.compute(this.#source));
	}

	async #init() {
		this.#engine = await TsvSheet.loader();
		this.#source = await readSource(this);
		this.addEventListener("focusout", (event) => this.#onEdit(event));
		this.#apply(this.#engine.compute(this.#source));
		this.#schedule();
	}

	#onEdit(event) {
		const td = event.target;
		if (td.dataset.row === undefined) {
			return;
		}
		const row = Number(td.dataset.row);
		const col = Number(td.dataset.col);
		const view = this.#engine.setCell(this.#source, row, col, td.textContent);
		this.#source = view.text;
		this.#apply(view);
	}

	/**
	 * The document's `.tsvt` text, for hosts that persist it: the text as
	 * loaded until the first edit, then the engine's canonical serialization
	 * (comment and shebang lines preserved — the element never serializes a
	 * grid itself).
	 */
	get source() {
		return this.#source;
	}

	#schedule() {
		if (this.#volatile) {
			this.#timer = globalThis.setInterval(this.#boundRefresh, this.refreshMs);
		}
	}

	#apply(view) {
		this.replaceChildren(buildTable(this.ownerDocument, view.computed));
		this.#volatile = view.volatile;
		return view;
	}
}

if (
	typeof customElements !== "undefined" &&
	customElements.get("tsv-sheet") === undefined
) {
	customElements.define("tsv-sheet", TsvSheet);
}
