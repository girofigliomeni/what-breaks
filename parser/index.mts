import { createHash } from "node:crypto";
import { isBuiltin } from "node:module";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { Project, Node, SyntaxKind, ts } from "ts-morph";
import { calculateGraph } from "./graph.mts";
import { detectAdapter } from "../adapters/index.mts";
import type { ImportKind, ImportRecord, ParseResult } from "./types.mts";

const excludedDirectories = new Set(["node_modules", "dist", "build", "out", "coverage"]);
const sourceExtension = /\.(?:[cm]?[jt]s|[jt]sx)$/i;
const slash = (value: string) => value.split(path.sep).join("/");
const message = (error: unknown) => error instanceof Error ? error.message : String(error);

export async function parseRepository(directory: string): Promise<ParseResult> {
  const root = await realpath(directory);
  if (!(await stat(root)).isDirectory()) throw new Error(`Not a directory: ${directory}`);
  const relative = (absolute: string) => slash(path.relative(root, absolute));
  const result: ParseResult = {
    version: 1, adapter: "none", files: [], edges: [], imports: [], routes: [],
    coverage: { filesFound: 0, filesParsed: 0, filesSkipped: 0, skipped: [], excludedDirectories: [], imports: { resolved: 0, external: 0, excluded: 0, unresolved: 0 } },
  };
  const candidates: string[] = [];
  const configs = new Set<string>();
  const dependencies = new Set<string>();
  const packages = new Map<string, Set<string>>();
  const skipped = new Map<string, string>();
  async function walk(folder: string): Promise<void> {
    // Unreadable directories fail the run: their unknown contents cannot be counted honestly.
    for (const entry of (await readdir(folder, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(folder, entry.name);
      const name = relative(absolute);
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".") || excludedDirectories.has(entry.name)) result.coverage.excludedDirectories.push({ path: name, reason: entry.name.startsWith(".") ? "Hidden directory excluded as a whole" : "Dependency or generated-output directory excluded as a whole" });
        else await walk(absolute);
        continue;
      }
      result.coverage.filesFound++;
      if (entry.isSymbolicLink()) skipped.set(name, "Symbolic links are not followed");
      else if (!entry.isFile()) skipped.set(name, "Not a regular file");
      else {
        if (entry.name === "package.json") {
          const packageDependencies = new Set<string>();
          const manifest: unknown = JSON.parse(await readFile(absolute, "utf8"));
          if (typeof manifest === "object" && manifest !== null) for (const key of ["dependencies", "devDependencies", "peerDependencies"]) {
            const group: unknown = Reflect.get(manifest, key);
            if (typeof group === "object" && group !== null && !Array.isArray(group)) for (const dependency of Object.keys(group)) {
              dependencies.add(dependency);
              packageDependencies.add(dependency);
            }
          }
          packages.set(relative(folder), packageDependencies);
        }
        if (entry.name === "tsconfig.json" || entry.name === "jsconfig.json") configs.add(absolute);
        if (sourceExtension.test(entry.name)) candidates.push(absolute);
        else skipped.set(name, "Unsupported file type (only TypeScript and JavaScript become nodes)");
      }
    }
  }
  await walk(root);
  const framework = detectAdapter(dependencies);
  result.adapter = framework.name;
  const defaults: ts.CompilerOptions = { allowJs: true, resolveJsonModule: true, jsx: ts.JsxEmit.Preserve, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, target: ts.ScriptTarget.ESNext, noEmit: true };
  const optionsCache = new Map<string, ts.CompilerOptions>();
  function compilerOptions(file: string): ts.CompilerOptions {
    let folder = path.dirname(file);
    while (true) {
      const config = [path.join(folder, "tsconfig.json"), path.join(folder, "jsconfig.json")].find((candidate) => configs.has(candidate));
      if (config) {
        const cached = optionsCache.get(config);
        if (cached) return cached;
        const parsed = ts.getParsedCommandLineOfConfigFile(config, {}, {
          ...ts.sys, readDirectory: () => [], getCurrentDirectory: () => root,
          onUnRecoverableConfigFileDiagnostic: (diagnostic) => { throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")); },
        });
        const errors = parsed?.errors.filter((error) => error.code !== 18003) ?? [];
        if (!parsed || errors.length) throw new Error(`Cannot read ${relative(config)}: ${errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, "\n")).join("; ")}`);
        const options = { ...defaults, ...parsed.options };
        optionsCache.set(config, options);
        return options;
      }
      if (folder === root) return defaults;
      folder = path.dirname(folder);
    }
  }
  const project = new Project({ skipAddingFilesFromTsConfig: true, skipFileDependencyResolution: true, skipLoadingLibFiles: true, compilerOptions: { ...defaults, noResolve: true, noLib: true } });
  const sources: { absolute: string; source: ReturnType<Project["createSourceFile"]>; options: ts.CompilerOptions }[] = [];
  for (const absolute of candidates) {
    const name = relative(absolute);
    try {
      const bytes = await readFile(absolute);
      const text = bytes.toString("utf8");
      if (text.includes("\u0000") || !Buffer.from(text).equals(bytes)) { skipped.set(name, "Source is not valid UTF-8 text"); continue; }
      const source = project.createSourceFile(absolute, text, { overwrite: true });
      const options = compilerOptions(absolute);
      result.files.push({ path: name, folder: slash(path.dirname(name)), module: name, lines: text.length === 0 ? 0 : text.split(/\r\n|\r|\n/).length - (/(?:\r\n|\r|\n)$/.test(text) ? 1 : 0), hash: createHash("sha256").update(bytes).digest("hex"), fanIn: 0, fanOut: 0 });
      sources.push({ absolute, source, options });
    } catch (error) { skipped.set(name, `Cannot parse file: ${message(error)}`); }
  }
  // Construct one program after adding files; rebuilding for each file is quadratic.
  const program = project.getProgram().compilerObject;
  const validSources = sources.filter(({ absolute, source }) => {
    const diagnostics = program.getSyntacticDiagnostics(source.compilerNode);
    if (!diagnostics.length) return true;
    skipped.set(relative(absolute), `Syntax error: ${diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")).join("; ")}`);
    return false;
  });
  result.files = result.files.filter((file) => !skipped.has(file.path));
  const sourceByPath = new Map(validSources.map(item => [relative(item.absolute), item.source]));
  const packageForPath = (name: string): string => {
    let folder = slash(path.dirname(name));
    while (folder !== ".") {
      if (packages.has(folder)) return folder;
      folder = slash(path.dirname(folder));
    }
    return "";
  };
  const packageSources = new Map<string, typeof validSources[number]["source"][]>();
  for (const [name, source] of sourceByPath) {
    const root = packageForPath(name);
    const members = packageSources.get(root) ?? [];
    members.push(source);
    packageSources.set(root, members);
  }
  const routesRecoverable = framework.routesRecoverable?.(validSources.map(item => item.source)) ?? true;
  for (const file of result.files) {
    const source = sourceByPath.get(file.path)!;
    const packageRoot = packageForPath(file.path);
    const description = framework.inspect({ path: file.path, source, packageRoot, packageDependencies: packages.get(packageRoot), packageSources: packageSources.get(packageRoot) });
    file.role = description.role;
    file.entry = description.entry ?? false;
    if (routesRecoverable) result.routes!.push(...description.routes);
  }
  const nodes = new Set(result.files.map((file) => file.path));
  for (const { absolute, source, options } of validSources) {
    async function record(kind: ImportKind, specifier: string, line: number, literal = true): Promise<void> {
      const item: ImportRecord = { source: relative(absolute), line, kind, specifier, status: "unresolved", target: null, reason: "" };
      if (!literal) item.reason = "Dynamic import argument is not a literal string";
      else if (isBuiltin(specifier)) { item.status = "external"; item.reason = "Node.js built-in module"; }
      else {
        const resolved = ts.resolveModuleName(specifier, absolute, options, ts.sys).resolvedModule;
        let target = resolved?.resolvedFileName;
        // An exact asset path is evidence of an excluded file, never a guessed source edge.
        if (!target && specifier.startsWith(".")) {
          const exact = path.resolve(path.dirname(absolute), specifier);
          try { if ((await stat(exact)).isFile() && !sourceExtension.test(exact)) target = exact; } catch { /* Resolution failure is recorded below. */ }
        }
        if (!target) item.reason = specifier.startsWith(".")
          ? `No file resolved for relative specifier ${JSON.stringify(specifier)} using this file's TypeScript compiler options`
          : `No module resolved for package or alias specifier ${JSON.stringify(specifier)} using this file's TypeScript compiler options`;
        else {
          const canonical = await realpath(target);
          const name = relative(canonical);
          item.target = slash(canonical);
          if (name.startsWith("../") || path.isAbsolute(name) || resolved?.isExternalLibraryImport || name.split("/").includes("node_modules")) {
            item.status = "external"; item.reason = "Resolved outside repository source (dependency or external file)";
          } else {
            item.target = name;
            if (nodes.has(name)) {
              item.status = "resolved"; item.reason = "Resolved by TypeScript to a parsed repository file";
              result.edges.push({ source: item.source, target: name, kinds: [kind] });
            } else { item.status = "excluded"; item.reason = skipped.get(name) ?? "Target is in an excluded directory"; }
          }
        }
      }
      result.imports.push(item);
      result.coverage.imports[item.status]++;
    }
    for (const declaration of source.getImportDeclarations()) await record("import", declaration.getModuleSpecifierValue(), declaration.getStartLineNumber());
    for (const declaration of source.getExportDeclarations()) {
      const specifier = declaration.getModuleSpecifierValue();
      if (specifier !== undefined) await record("re-export", specifier, declaration.getStartLineNumber());
    }
    for (const call of source.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (call.getExpression().getKind() !== SyntaxKind.ImportKeyword) continue;
      const argument = call.getArguments()[0];
      await record("dynamic-import", argument && Node.isStringLiteral(argument) ? argument.getLiteralValue() : argument?.getText() ?? "", call.getStartLineNumber(), argument !== undefined && Node.isStringLiteral(argument));
    }
  }
  Object.assign(result, calculateGraph(result.files, result.edges));
  result.coverage.skipped = [...skipped].map(([path, reason]) => ({ path, reason }));
  result.coverage.filesParsed = result.files.length;
  result.coverage.filesSkipped = skipped.size;
  return result;
}
