.DEFAULT_GOAL := help

# The JavaScript package's quality gate: eslint (complexity <= 7) and the node
# test runner at 100% line coverage of the source (src/tsvsheet — the vendored
# Go build artifacts tsvsheet.wasm and wasm_exec.js are excluded from every
# gate). The engine itself is NOT reimplemented here: it is the Go engine
# compiled to WebAssembly and embedded, re-downloaded by the `wasm` target.

TSVSHEET_WASM_VERSION := v0.12.1
# Out-of-band integrity: the expected sha256 of each pinned release asset
# (`gh release view $(TSVSHEET_WASM_VERSION) --repo tsvsheet/go-tsvsheet --json
# assets`). `make wasm` verifies the download against these, so a moved tag or a
# tampered asset fails the build. Update both when bumping the version.
TSVSHEET_WASM_SHA256 := eeea5b8170ab12b291849e268710409bf8e0f06aa0818a24e2b47ea1e515c2a7
TSVSHEET_WASM_EXEC_SHA256 := 5b642017724b7bef23b4f6606e28e5ed9788fdd0cdfafc06f3f216292715526b

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
	gh release download $(TSVSHEET_WASM_VERSION) --repo tsvsheet/go-tsvsheet --pattern 'tsvsheet.wasm' --output src/tsvsheet/tsvsheet.wasm --clobber
	echo "$(TSVSHEET_WASM_SHA256)  src/tsvsheet/tsvsheet.wasm" | shasum -a 256 -c -
	gh release download $(TSVSHEET_WASM_VERSION) --repo tsvsheet/go-tsvsheet --pattern 'wasm_exec.js' --output src/tsvsheet/wasm_exec.js --clobber
	echo "$(TSVSHEET_WASM_EXEC_SHA256)  src/tsvsheet/wasm_exec.js" | shasum -a 256 -c -

playground: ## Build the browser playground bundle
	node playground/build.mjs
