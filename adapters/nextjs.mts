import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import type { FrameworkAdapter } from "./index.mts";
import { hasDirective, reactRole } from "./index.mts";
import { genericRole } from "./taxonomy.mts";
import { isFrameworkEntry } from "./file-conventions.mts";

const methods = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
const configurationCache = new WeakMap<readonly SourceFile[], boolean>();
function routesRecoverable(sources: readonly SourceFile[]): boolean {
  const cached = configurationCache.get(sources);
  if (cached !== undefined) return cached;
  const recoverable = !sources.some(file => /(?:^|\/)next\.config\./.test(file.getFilePath()) && file.getDescendantsOfKind(SyntaxKind.Identifier).some(identifier => identifier.getText() === "basePath"));
  configurationCache.set(sources, recoverable);
  return recoverable;
}
function routePattern(path: string): string | undefined {
  const segments = path.split("/");
  // Interception and parallel routes need context beyond a file's own path.
  if (segments.some(segment => segment.startsWith("@") || segment.startsWith("_") || /^\(\./.test(segment))) return;
  return "/" + segments.filter(segment => segment && !/^\([^()]+\)$/.test(segment)).join("/");
}
export const nextAdapter: FrameworkAdapter = {
  name: "nextjs", matches: dependencies => dependencies.has("next"),
  inspect(input) {
    const { path, source } = input;
    if (input.packageDependencies && !input.packageDependencies.has("next")) return { role: reactRole(input), routes: [] };
    const localPath = input.packageRoot ? path.slice(input.packageRoot.length + 1) : path;
    const recoverable = routesRecoverable(input.packageSources ?? [source]);
    const app = /^(?:src\/)?app\/(?:(.*)\/)?(page|route|layout)\.(?:js|jsx|ts|tsx)$/.exec(localPath);
    if (app) {
      if ((app[1] ?? "").split("/").some(segment => segment.startsWith("_"))) return { role: reactRole(input), routes: [] };
      const role = app[2] === "page" ? "Page routes" : app[2] === "route" ? "API endpoints" : "Layouts";
      const pattern = recoverable ? routePattern(app[1] ?? "") : undefined;
      const routes = [];
      if (pattern !== undefined && app[2] === "page" && source.getExportedDeclarations().has("default")) routes.push({ file: path, line: 1, method: "GET", pattern });
      if (pattern !== undefined && app[2] === "route") {
        // Re-exports and imported bindings do not prove an HTTP handler here.
        for (const statement of source.getStatements()) {
          if (Node.isFunctionDeclaration(statement) && statement.isExported() && !statement.isDefaultExport() && methods.has(statement.getName() ?? "") && statement.getBody()) routes.push({ file: path, line: statement.getStartLineNumber(), method: statement.getName()!, pattern });
          if (Node.isVariableStatement(statement) && statement.isExported()) for (const declaration of statement.getDeclarations()) {
            const initializer = declaration.getInitializer();
            if (methods.has(declaration.getName()) && initializer && (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))) routes.push({ file: path, line: declaration.getStartLineNumber(), method: declaration.getName(), pattern });
          }
        }
      }
      return { role, entry: true, routes };
    }
    const pages = /^(?:src\/)?pages\/(.*)\.(?:js|jsx|ts|tsx)$/.exec(localPath);
    if (pages) {
      if (pages[1].startsWith("api/")) return { role: "API endpoints", entry: true, routes: [] };
      if (!/(^|\/)_(app|document|error)$/.test(pages[1])) {
        const pattern = recoverable ? routePattern(pages[1].replace(/(^|\/)index$/, "")) : undefined;
        return { role: "Page routes", entry: true, routes: pattern !== undefined && source.getExportedDeclarations().has("default") ? [{ file: path, line: 1, method: "GET", pattern }] : [] };
      }
    }
    if (hasDirective(source, "use server") || source.getDescendants().some(fn => {
      if (!Node.isFunctionDeclaration(fn) && !Node.isFunctionExpression(fn) && !Node.isArrowFunction(fn)) return false;
      const body = fn.getBody();
      return body && Node.isBlock(body) && hasDirective(body, "use server");
    })) return { role: "Server actions", entry: true, routes: [] };
    const role = reactRole(input);
    return { role: role === "Hooks" ? genericRole(path) : role, entry: isFrameworkEntry(localPath), routes: [] };
  },
};
