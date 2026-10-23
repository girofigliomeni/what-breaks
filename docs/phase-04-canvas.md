# Canvas preview

Open `/preview`. Click a folder to open a bounded panel; click its header to
close it. Select a file row to highlight its immediate connections. Click the
canvas to clear selection. Height of a collapsed folder is `64 + 9 × √fanIn`
pixels; fan-in counts distinct outside files importing any member. Width follows
the label. Expanded rows show each file's parser-computed fan-in.

The fixture is unmodified version-1 parser output from the local Zod clone at
commit `afdac65e0f80c0ccf9e8909da97c411567908b57`. It contains 520 parsed files,
199 skipped inventory entries and 864 resolved edges. All import outcomes and
skip reasons remain in the fixture. The category rail groups parsed files by
their actual final file extension, with a swatch and count for each extension.
No framework adapter or semantic category classifier has run.

Folding starts again from the original directories at each threshold. Sibling
merge decisions share a snapshot at their depth. Threshold 7 produces 22 nodes,
23.6 files per node, no singleton nodes and no invalid endpoints. The approximate
ten-files-per-node target cannot also fit 520 files into at most 24 nodes.

Run `node scripts/verify-folding.mts` for the terminal counts. Browser checks
remain manual. Panels scroll through all files in a list bounded to eight rows,
with a fixed header and an explicit count of files below the viewport.
Connections follow visible rows during scrolling; offscreen file endpoints stay
at the top or bottom list boundary.

The approved pnpm release-age exceptions apply only to existing Next.js 16.4.3
pins. The normal release-age policy remains active for other packages.
