# Phase 03 parser

Requires Node.js 24 (native TypeScript execution) and pnpm.

```sh
pnpm parse /path/to/repository --output /path/to/new-result.json
pnpm verify:parser
pnpm verify:parser /path/to/cloned/zod
```

The parser takes a local directory and never fetches code. Output paths must
be new files, so a run cannot overwrite source or an earlier result. The command
writes JSON and reads it back through the versioned runtime validator. The
TypeScript contract is exported from `parser/types.mts`; use `readResult` from
`parser/contract.mts` when loading persisted data.

All regular TypeScript and JavaScript files are selected, including declarations,
tests, and `.mts`, `.cts`, `.mjs`, `.cjs`, `.tsx` and `.jsx` files. No size ranking
or file limit is applied. Hidden directories and directories named `node_modules`,
`dist`, `build`, `out` and `coverage` are excluded as whole subtrees and listed
separately. File counts describe the remaining inventory: found = parsed + skipped.
Every skipped entry has a path and reason. Symbolic links are not followed;
unreadable directories fail the run because their unknown contents cannot be counted.

Files carry their exact repository-relative folder (`.` for root files), complete
path as module identity, physical line count and SHA-256 hash of the original bytes.
Source files must be valid UTF-8. Syntax errors skip the file with diagnostics.
The fallback adapter identifies modules without framework knowledge.

Resolution uses TypeScript's resolver with the nearest `tsconfig.json` or
`jsconfig.json`, including inherited compiler options. With no config it uses
bundler resolution. Static imports, re-exports with module specifiers and literal
dynamic imports produce edges only when their resolved targets are parsed nodes.
Nonliteral dynamic imports are recorded as unresolved. `require()` is out of scope.
Each import occurrence retains its source, line, specifier, outcome and reason.
Resolved dependencies outside the selected source are external; known omitted
targets are excluded. An unresolved package is never assumed to be external.

Edges are unique source/target pairs with their observed import kinds. Fan-in and
fan-out count distinct neighbours, including self-imports if present. Graph
calculations are pure functions. The output reader checks field types, coverage
totals, folders, endpoints, edge deduplication and degree counts against imports.

Verification fixtures cover aliases, `.js` to `.ts` resolution, all three import
kinds, duplicate edges, syntax skips, excluded files, nonliteral imports, corrupt
output rejection and renaming an imported file. Temporary fixtures are retained;
the verifier does not delete files.

Acceptance evidence: this project has 52 inventoried files, 23 parsed, 29 skipped
(unsupported file types), 10 source folders, 17 edges and zero unresolved imports.
The cloned `colinhacks/zod` repository at commit
`afdac65e0f80c0ccf9e8909da97c411567908b57` has 719 inventoried
files, 520 parsed, 199 skipped, and 50 distinct source folders. Of 138 re-exports,
137 resolve. The remaining `packages/mini/src/index.ts:1` re-exports `zod/mini`,
which TypeScript cannot resolve in the clone without installed workspace packages.
Every skip and import outcome is preserved in the JSON output. The rename fixture
produces exactly one unresolved relative import and no edge to the renamed file.

Installation note: pnpm's default 24-hour release-age policy currently rejects
the existing Next.js 16.4.3 packages published on October 23, 2026. No release-age
exceptions are configured. A frozen clean install will fail until those packages
age past the policy cutoff. The native resolver build approval is scoped to
`unrs-resolver`.
