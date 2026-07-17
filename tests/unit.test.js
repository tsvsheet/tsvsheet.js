/**
 * Unit tests for @tsvsheet/tsvsheet: the typed Engine facade over the embedded
 * WebAssembly engine, the load contract (including the bad-bytes failure path),
 * and the <tsv-sheet> custom element rendered over a minimal happy-dom DOM.
 * The suite alone reaches full line coverage of src/tsvsheet (wasm_exec.js, the
 * vendored Go runtime glue, is excluded from the gate).
 */

import assert from "node:assert/strict";
import test from "node:test";

import { Window } from "happy-dom";

import {
	CODES,
	Engine,
	TsvsheetError,
	load,
	loadFrom,
} from "../src/tsvsheet/index.js";
import {
	defineGo,
	pickEngine,
	readBytes,
	readText,
} from "../src/tsvsheet/load.js";

// The engine is loaded once and shared by every test below.
const engine = await load();

// A minimal DOM for the web-component tests: install the globals the element
// class closes over, then import the module so its define() runs against them.
const window = new Window();
globalThis.HTMLElement = window.HTMLElement;
globalThis.customElements = window.customElements;
globalThis.Event = window.Event;
const { TsvSheet, buildTable, readSource, sharedEngine, toTsv } = await import(
	"../src/tsvsheet/tsv-sheet.js"
);
TsvSheet.loader = async () => engine;

const SHEET = "1\t2\t=A1+B1\n=A1*10\t=A2/0\t=NOW()";

// -- engine: compute --------------------------------------------------------

test("compute: literals and formulas resolve in place", () => {
	const view = engine.compute(SHEET);
	assert.deepEqual(view.computed[0], ["1", "2", "3"]);
	assert.equal(view.computed[1][0], "10");
	assert.equal(view.source[0][2], "=A1+B1");
	assert.equal(view.volatile, true); // =NOW() is clock-volatile
});

test("compute: a division by zero propagates as #DIV/0!", () => {
	assert.equal(engine.compute(SHEET).computed[1][1], "#DIV/0!");
});

test("compute: a static sheet is not volatile", () => {
	assert.equal(engine.compute("1\t2").volatile, false);
});

test("compute: an unknown function is a non-fatal diagnostic", () => {
	const view = engine.compute("=BOGUS()");
	assert.equal(view.computed[0][0], "#NAME?");
	assert.deepEqual(view.diagnostics, [
		{ cell: "A1", message: "unknown function: BOGUS", fatal: false },
	]);
});

// -- engine: edits ----------------------------------------------------------

test("setCell: an edit recomputes dependents and round-trips the source", () => {
	const view = engine.setCell(SHEET, 0, 0, "5");
	assert.equal(view.source[0][0], "5");
	assert.equal(view.computed[0][2], "7"); // C1 = A1 + B1 = 5 + 2
	assert.equal(view.computed[1][0], "50"); // A2 = A1 * 10
	// The returned source, re-serialized, recomputes to the same grid.
	const again = engine.compute(toTsv(view.source));
	assert.deepEqual(again.computed[0], view.computed[0]);
});

test("structural edits shift, blank, and #REF! as specified", () => {
	assert.deepEqual(engine.insertRow(SHEET, 0, 0).computed[0], ["", "", ""]);
	assert.equal(engine.deleteRow(SHEET, 0, 0).computed[0][0], "#REF!");
	assert.equal(engine.insertCol(SHEET, 0, 0).computed[0][0], "");
	assert.equal(engine.deleteCol(SHEET, 0, 0).computed[0][0], "2");
});

// -- engine: references + explain ------------------------------------------

test("references: precedents are spans, dependents are addresses", () => {
	const refs = engine.references(SHEET, 0, 2); // C1 = A1 + B1
	assert.deepEqual(refs.precedents[0], {
		from: { row: 0, col: 0 },
		to: { row: 0, col: 0 },
	});
	const dep = engine.references("1\t=A1", 0, 0); // A1 is read by B1
	assert.deepEqual(dep.dependents, [{ row: 0, col: 1 }]);
});

test("explain: traces a cell's value, formula, and inputs", () => {
	const trace = engine.explain(SHEET, 0, 2);
	assert.equal(trace.cell, "C1");
	assert.equal(trace.value, "3");
	assert.equal(trace.formula, "A1 + B1");
	assert.deepEqual(trace.inputs, [
		{ ref: "A1", value: "1" },
		{ ref: "B1", value: "2" },
	]);
});

// -- engine: error contract -------------------------------------------------

test("errors: a malformed formula is a typed engine error", () => {
	let err = null;
	try {
		engine.setCell(SHEET, 0, 0, "=A1+");
	} catch (e) {
		err = e;
	}
	assert.ok(err instanceof TsvsheetError);
	assert.equal(err.code, CODES.ENGINE);
});

test("errors: unparseable source is a typed engine error", () => {
	assert.throws(
		() => engine.compute("=SUM("),
		(e) => e instanceof TsvsheetError && e.code === "engine",
	);
});

test("errors: bad wasm bytes fail load with a typed error and cause", async () => {
	let err = null;
	try {
		await loadFrom(new Uint8Array([0, 1, 2, 3]));
	} catch (e) {
		err = e;
	}
	assert.ok(err instanceof TsvsheetError);
	assert.equal(err.code, CODES.LOAD);
	assert.equal(err.name, "TsvsheetError");
	assert.ok(err.cause !== undefined);
});

test("api: Engine and CODES shape", () => {
	assert.ok(engine instanceof Engine);
	assert.deepEqual(CODES, { LOAD: "load", ENGINE: "engine" });
	const e = new TsvsheetError(CODES.LOAD);
	assert.equal(e.message, "load"); // message defaults to the code
});

// -- load: the shared, memoized loader -------------------------------------

test("sharedEngine: instantiates once and reuses the promise", async () => {
	const first = sharedEngine();
	assert.equal(sharedEngine(), first); // same pending promise
	assert.ok((await first) instanceof Engine);
});

// -- load: the reader seams and guard branches -----------------------------

test("readText/readBytes: the browser fetch path", async () => {
	const realFetch = globalThis.fetch;
	globalThis.fetch = async () => ({
		text: async () => "hello",
		arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
	});
	try {
		assert.equal(await readText("x", false), "hello"); // node=false → fetchText
		assert.deepEqual([...(await readBytes("x", false))], [1, 2, 3]); // → fetchArrayBuffer
	} finally {
		globalThis.fetch = realFetch;
	}
});

test("defineGo: a script that fails to define Go is a load error", () => {
	assert.throws(
		() => defineGo("globalThis.Go = 42;"), // not a constructor
		(e) => e instanceof TsvsheetError && e.code === CODES.LOAD,
	);
});

test("pickEngine: a missing tsvsheet global is a load error", () => {
	const real = globalThis.tsvsheet;
	globalThis.tsvsheet = undefined;
	try {
		assert.throws(
			() => pickEngine(),
			(e) => e instanceof TsvsheetError && e.code === CODES.LOAD,
		);
	} finally {
		globalThis.tsvsheet = real;
	}
});

// -- web component: pure helpers -------------------------------------------

test("toTsv: joins columns with TAB and rows with newline", () => {
	assert.equal(toTsv([["1", "2"], ["=A1"]]), "1\t2\n=A1");
});

test("buildTable: editable cells carry their coordinates", () => {
	const table = buildTable(window.document, [["a", "b"], ["c", "d"]]);
	assert.equal(table.querySelectorAll("tr").length, 2);
	const td = table.querySelector('td[data-row="1"][data-col="1"]');
	assert.equal(td.textContent, "d");
	assert.equal(td.contentEditable, "true");
});

test("readSource: source attr, src fetch, then text content", async () => {
	const withAttr = window.document.createElement("div");
	withAttr.setAttribute("source", "1\t2");
	assert.equal(await readSource(withAttr), "1\t2");

	const withSrc = window.document.createElement("div");
	withSrc.setAttribute("src", "/sheet.tsvt");
	const realFetch = globalThis.fetch;
	globalThis.fetch = async () => ({ text: async () => "3\t4" });
	try {
		assert.equal(await readSource(withSrc), "3\t4");
	} finally {
		globalThis.fetch = realFetch;
	}

	const withText = window.document.createElement("div");
	withText.textContent = "  5\t6  ";
	assert.equal(await readSource(withText), "5\t6");
});

// -- web component: the element lifecycle ----------------------------------

test("tsv-sheet: registered, renders, edits, and refreshes", async () => {
	assert.equal(customElements.get("tsv-sheet"), TsvSheet);

	const el = window.document.createElement("tsv-sheet");
	el.setAttribute("source", "1\t2\t=A1+B1");
	window.document.body.appendChild(el);
	await el.ready;

	// The computed grid renders as a table.
	assert.equal(
		el.querySelector('td[data-row="0"][data-col="2"]').textContent,
		"3",
	);

	// Editing A1 to 5 recomputes C1 to 7.
	const a1 = el.querySelector('td[data-row="0"][data-col="0"]');
	a1.textContent = "5";
	a1.dispatchEvent(new window.Event("focusout", { bubbles: true }));
	assert.equal(
		el.querySelector('td[data-row="0"][data-col="2"]').textContent,
		"7",
	);

	// A focusout that is not on a cell is a no-op.
	el.dispatchEvent(new window.Event("focusout", { bubbles: true }));

	// refresh() recomputes in place without throwing.
	el.refresh();
	assert.ok(el.querySelector("table") !== null);

	el.remove(); // non-volatile: no timer to clear
});

test("tsv-sheet: a volatile sheet schedules and clears a refresh timer", async () => {
	const el = window.document.createElement("tsv-sheet");
	el.setAttribute("source", "=NOW()");
	window.document.body.appendChild(el);
	await el.ready;
	assert.ok(el.querySelector("table") !== null);
	el.remove(); // volatile: clears the interval so the test process can exit
});

test("tsv-sheet: refresh before the engine loads is a no-op", () => {
	const el = window.document.createElement("tsv-sheet");
	el.refresh(); // engine undefined — returns without rendering
	assert.equal(el.querySelector("table"), null);
});
