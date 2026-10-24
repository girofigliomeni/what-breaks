// Filename conventions describe roles without inferring them from a folder name.
// These entry points are reached outside the import graph. This deliberately
// excludes them from "nothing imports" insights without claiming they are unused.
export function isFrameworkEntry(path: string): boolean {
  const name = path.split("/").at(-1) ?? path;
  if (/^next\.config\.(js|mjs|ts)$/.test(path)) return true;
  if (/^(src\/)?(middleware|proxy|instrumentation|instrumentation-client)\.[cm]?[jt]sx?$/.test(path)) return true;
  if (/^(src\/)?pages\/.*\.[cm]?[jt]sx?$/.test(path)) return true;
  return /^(src\/)?app\//.test(path) && /^(page|route|layout|template|default|loading|error|global-error|not-found|global-not-found|forbidden|unauthorized|sitemap|robots|manifest|icon|apple-icon|opengraph-image|twitter-image)\.[cm]?[jt]sx?$/.test(name);
}

export function fileExtension(path: string): string {
  const name = path.split("/").at(-1) ?? path;
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "No extension" : name.slice(dot).toLowerCase();
}

export function fileRole(path: string): string {
  const name = path.split("/").at(-1) ?? path;
  if (/\.d\.[cm]?ts$/.test(name)) return "Type declaration";
  if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(name)) return "Test";
  if (/\.config\.[cm]?[jt]s$/.test(name) || /^\.[\w-]+rc\.[cm]?[jt]s$/.test(name)) return "Configuration";
  if (/^index\.[cm]?[jt]sx?$/.test(name)) return "Module index";
  return "Unidentified";
}
