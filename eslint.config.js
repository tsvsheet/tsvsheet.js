import js from "@eslint/js";

export default [
	// The vendored Go runtime glue is a build artifact, not our code.
	{ ignores: ["src/tsvsheet/wasm_exec.js"] },
	js.configs.recommended,
	{
		files: ["src/tsvsheet/**/*.js", "tests/**/*.js"],
		languageOptions: {
			ecmaVersion: 2023,
			sourceType: "module",
			globals: {
				WebAssembly: "readonly",
				fetch: "readonly",
				customElements: "readonly",
				HTMLElement: "readonly",
				process: "readonly",
				URL: "readonly",
				console: "readonly",
			},
		},
		rules: {
			complexity: ["error", 7],
			"no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
		},
	},
];
