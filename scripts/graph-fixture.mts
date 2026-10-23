import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseRepository } from "../parser/index.mts";
import { validateResult } from "../parser/contract.mts";

// Parse real temporary source instead of depending on checked-in parser output.
export async function graphFixture() {
  const directory = await mkdtemp(path.join(tmpdir(), "what-breaks-graph-"));
  try {
    for (let folder = 0; folder < 30; folder++) {
      await mkdir(path.join(directory, `module-${folder}`));
      await writeFile(path.join(directory, `module-${folder}/a.ts`), "export { b } from './b';\nexport const a = 1;\n");
      await writeFile(path.join(directory, `module-${folder}/b.ts`), "export { a } from './a';\nexport const b = 2;\n");
      await writeFile(path.join(directory, `module-${folder}/view.tsx`), "export const view = <div />;\n");
    }
    return validateResult(await parseRepository(directory));
  } finally { await rm(directory, { recursive: true, force: true }); }
}
