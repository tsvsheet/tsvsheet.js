.DEFAULT_GOAL := help

# The JavaScript package's quality gate: eslint (complexity <= 7) and the node
# test runner at 100% line coverage of the source (src/tsvsheet — the vendored
# Go build artifacts tsvsheet.wasm and wasm_exec.js are excluded from every
# gate). The engine itself is NOT reimplemented here: it is the Go engine
# compiled to WebAssembly and embedded, re-downloaded by the `wasm` target.

TSVSHEET_WASM_VERSION := v0.27.0
# Out-of-band integrity: the expected sha256 of each pinned release asset
# (`gh release view $(TSVSHEET_WASM_VERSION) --repo tsvsheet/go-tsvsheet --json
# assets`). `make wasm` verifies the download against these, so a moved tag or a
# tampered asset fails the build. Update both when bumping the version.
TSVSHEET_WASM_SHA256 := 53e8585dbb37c6acd5e6c3d9e0aab88c5581bae1058c2b7480091be8f879ce9d
TSVSHEET_WASM_EXEC_SHA256 := 5b642017724b7bef23b4f6606e28e5ed9788fdd0cdfafc06f3f216292715526b

.PHONY: help check ci lint test wasm playground

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*## "}{printf "  %-10s %s\n", $$1, $$2}'

check: lint test format-check ## Full quality gate

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

# CI runs biome over this repo through the shared TypeScript image, using its own
# file-selection rules (generated markers, minified bundles and coverage/ are
# excluded). Running the SAME image here is what makes a local pass mean a remote
# pass: a hand-rolled biome call would drift from the pinned one, and a gate that
# disagrees with CI is a gate people stop trusting.
# The tag floats on purpose and is not digest-pinned: the workflow references
# the same `@v2`, so pinning a digest here would put the local gate on a
# different binary than CI — the very drift this target exists to remove. It is
# the org's own registry, already trusted by every workflow in the fleet, and
# `?=` lets a caller pin a digest for a one-off audited run.
TS_CI_IMAGE ?= ghcr.io/nicerobot/tools.build/ci/typescript:v2

.PHONY: format-check
format-check: ## biome, via the same pinned image CI runs
	docker run --rm -v "$(CURDIR)":/github/workspace -w /github/workspace $(TS_CI_IMAGE)
