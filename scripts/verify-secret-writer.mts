// Integration check: provide disposable, pre-created analysis IDs in the target
// database. Run with --conditions=react-server --env-file=.env.local. No keys log.
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/supabase/database.types.ts";
import { analysisStore } from "../lib/supabase/analysis-store.ts";
import { parseRepository } from "../parser/index.mts";

const [organization, analysis, failureAnalysis, foreignAnalysis] = process.argv.slice(2);
if (!organization || !analysis || !failureAnalysis || !foreignAnalysis) throw new Error("Provide organization, new analysis, failure analysis and foreign analysis fixture IDs.");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Missing public Supabase configuration.");
const config = { url, key };

let expired = false;
let submissions = 0;
function submission(id: string, created = true) {
  return createClient<Database>(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    accessToken: async () => {
      if (expired) throw new Error("Submission token expired");
      return "simulated-submission-token";
    },
    global: { fetch: async () => {
      if (expired) throw new Error("Submission token expired");
      submissions++;
      return Response.json({ id, created });
    } },
  });
}

const writer = analysisStore(organization, submission(analysis));
await writer.begin("https://github.com/verification/secret-writer");
expired = true;
await assert.rejects(writer.stage(foreignAnalysis, "parsing", "Wrong analysis"), /not bound/);
await assert.rejects(writer.fail(foreignAnalysis, "parsing", "Wrong analysis"), /not bound/);
await writer.stage(analysis, "parsing", "Submission token has expired.", "a".repeat(40));
const directory = await mkdtemp(path.join(tmpdir(), "what-breaks-secret-writer-"));
try {
  await writeFile(path.join(directory, "main.ts"), "export { value } from './value';\n");
  await writeFile(path.join(directory, "value.ts"), "export const value = 1;\n");
  const result = await parseRepository(directory);
  await assert.rejects(writer.complete(foreignAnalysis, result), /not bound/);
  await writer.stage(analysis, "storing", "Saving without the submission token.");
  await writer.complete(analysis, result);
} finally { await rm(directory, { recursive: true, force: true }); }
assert.equal(submissions, 1);
await assert.rejects(writer.begin("https://github.com/verification/another"), /only one/);

expired = false;
const failureWriter = analysisStore(organization, submission(failureAnalysis));
await failureWriter.begin("https://github.com/verification/secret-writer-failure");
expired = true;
await failureWriter.fail(failureAnalysis, "parsing", "Failure persisted after submission token expiry.");

expired = false;
const foreignWriter = analysisStore(organization, submission(foreignAnalysis));
await assert.rejects(foreignWriter.begin("https://github.com/verification/foreign"), /captured organization/);
const reusedWriter = analysisStore(organization, submission(analysis, false));
assert.equal((await reusedWriter.begin("https://github.com/verification/secret-writer")).created, false);
await assert.rejects(reusedWriter.stage(analysis, "parsing", "Must not overwrite"), /not bound/);
console.log("Secret writer: real database completion/failure without reuse of the submission token; foreign IDs, foreign organizations, repeat starts and existing-analysis writes rejected.");
