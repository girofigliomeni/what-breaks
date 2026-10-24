const headers = { Accept: "application/vnd.github+json", "User-Agent": "what-breaks" };
const maximumArchive = 128 * 1024 * 1024;

export function repositoryUrl(input: string): string {
  const url = URL.parse(input.trim());
  if (!url || url.protocol !== "https:" || url.hostname !== "github.com" || url.port || url.username || url.password || url.search || url.hash) throw new Error("Enter a public repository URL: https://github.com/owner/repository");
  const match = /^\/([a-z0-9-]+)\/([a-z0-9_.-]+?)(?:\.git)?\/?$/i.exec(url.pathname);
  if (!match || match[2] === "." || match[2] === "..") throw new Error("Enter the repository root URL, without a branch or file path.");
  return `https://github.com/${match[1]}/${match[2]}`.toLowerCase();
}

async function checkedFetch(url: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(60000), redirect: "error" });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "TimeoutError")
      throw new Error(`GitHub ${url.startsWith("https://api.github.com/") ? "commit lookup" : "archive download"} timed out after 60 seconds. Retry the analysis.`);
    throw error;
  }
  if (!response.ok) {
    if (response.status === 404) throw new Error("GitHub repository was not found or is not public.");
    if (response.status === 403 || response.status === 429) throw new Error("GitHub refused the request or its public API rate limit was reached. Try again later.");
    throw new Error(`GitHub returned HTTP ${response.status}.`);
  }
  return response;
}

export async function fetchRepository(input: string): Promise<{ archive: Buffer; commit: string }> {
  const repository = repositoryUrl(input).slice("https://github.com/".length);
  const metadata: unknown = await (await checkedFetch(`https://api.github.com/repos/${repository}/commits/HEAD`)).json();
  if (typeof metadata !== "object" || metadata === null || !("sha" in metadata) || typeof metadata.sha !== "string" || !/^[a-f0-9]{40}$/.test(metadata.sha)) throw new Error("GitHub did not return a commit SHA.");
  // Pin the archive to the resolved commit, even if the default branch moves now.
  const response = await checkedFetch(`https://codeload.github.com/${repository}/zip/${metadata.sha}`);
  if (Number(response.headers.get("content-length")) > maximumArchive) { await response.body?.cancel(); throw new Error("Repository exceeds the 128 MiB download limit."); }
  if (!response.body) throw new Error("GitHub returned an empty archive.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maximumArchive) { await reader.cancel(); throw new Error("Repository exceeds the 128 MiB download limit."); }
      chunks.push(value);
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "TimeoutError")
      throw new Error("GitHub archive download timed out after 60 seconds. Retry the analysis.");
    throw error;
  } finally { reader.releaseLock(); }
  return { archive: Buffer.concat(chunks), commit: metadata.sha };
}
