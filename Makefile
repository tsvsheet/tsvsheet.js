.DEFAULT_GOAL := help

# The JavaScript package's quality gate: eslint (complexity <= 7) and the node
# test runner at 100% line coverage of the source (src/tsvsheet — the vendored
# Go build artifacts tsvsheet.wasm and wasm_exec.js are excluded from every
# gate). The engine itself is NOT reimplemented here: it is the Go engine
# compiled to WebAssembly and embedded, re-downloaded by the `wasm` target.

TSVSHEET_WASM_VERSION := v0.3.0

.PHONY: help check ci lint test wasm playground

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*## "}{printf "  %-10s %s\n", $$1, $$2}'

check: lint test ## Full quality gate

ci: check ## Full gate as run by CI

lint: ## eslint on the source and tests
	npm run --silent lint

test: ## node --test with 100% line coverage of src/tsvsheet
	npm test

wasm: ## Re-download the pinned engine wasm + Go runtime glue
	gh release download $(TSVSHEET_WASM_VERSION) --repo uplang/go-tsvsheet --pattern 'tsvsheet.wasm' --output src/tsvsheet/tsvsheet.wasm --clobber
	gh release download $(TSVSHEET_WASM_VERSION) --repo uplang/go-tsvsheet --pattern 'wasm_exec.js' --output src/tsvsheet/wasm_exec.js --clobber

playground: ## Build the browser playground bundle
	node playground/build.mjs
