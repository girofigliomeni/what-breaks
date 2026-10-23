import { readFile, writeFile } from "node:fs/promises";
import { calculateGraph } from "./graph.mts";
import type { ImportKind, ImportStatus, ParseResult } from "./types.mts";

const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const count = (value: unknown): value is number => Number.isSafeInteger(value) && typeof value === "number" && value >= 0;
const text = (value: unknown): value is string => typeof value === "string";
const kind = (value: unknown): value is ImportKind => value === "import" || value === "re-export" || value === "dynamic-import";
const status = (value: unknown): value is ImportStatus => value === "resolved" || value === "external" || value === "excluded" || value === "unresolved";
const localPath = (value: unknown): value is string => text(value) && value.length > 0 && !value.includes("\\") && !value.startsWith("/") && !/^[a-z]:/i.test(value) && !value.split("/").includes("..");
const reasonEntry = (value: unknown) => object(value) && localPath(value.path) && text(value.reason) && value.reason.length > 0;

export function isParseResult(value: unknown): value is ParseResult {
  if (!object(value) || value.version !== 1 || !text(value.adapter) || !Array.isArray(value.files) || !Array.isArray(value.edges) || !Array.isArray(value.imports) || !object(value.coverage)) return false;
  const coverage = value.coverage;
  if (!count(coverage.filesFound) || !count(coverage.filesParsed) || !count(coverage.filesSkipped) || !Array.isArray(coverage.skipped) || !coverage.skipped.every(reasonEntry) || !Array.isArray(coverage.excludedDirectories) || !coverage.excludedDirectories.every(reasonEntry) || !object(coverage.imports)) return false;
  if (!["resolved", "external", "excluded", "unresolved"].every((key) => object(coverage.imports) && count(coverage.imports[key]))) return false;
  if (!value.files.every((file: unknown) => object(file) && localPath(file.path) && localPath(file.folder) && text(file.module) && file.module.length > 0 && count(file.lines) && text(file.hash) && /^[a-f0-9]{64}$/.test(file.hash) && count(file.fanIn) && count(file.fanOut))) return false;
  if (!value.edges.every((edge: unknown) => object(edge) && localPath(edge.source) && localPath(edge.target) && Array.isArray(edge.kinds) && edge.kinds.length > 0 && edge.kinds.every(kind))) return false;
  if (!value.imports.every((item: unknown) => object(item) && localPath(item.source) && count(item.line) && item.line > 0 && kind(item.kind) && text(item.specifier) && status(item.status) && (item.target === null || text(item.target)) && text(item.reason) && item.reason.length > 0)) return false;
  return true;
}

export function validateResult(value: unknown): ParseResult {
  if (!isParseResult(value)) throw new Error("Invalid parser output: expected the version 1 contract.");
  const { coverage } = value;
  if (coverage.filesFound !== coverage.filesParsed + coverage.filesSkipped || coverage.filesParsed !== value.files.length || coverage.filesSkipped !== coverage.skipped.length) throw new Error("Invalid file coverage totals.");
  const paths = new Set(value.files.map((file) => file.path));
  if (paths.size !== value.files.length || new Set(coverage.skipped.map((file) => file.path)).size !== coverage.skipped.length || coverage.skipped.some((file) => paths.has(file.path))) throw new Error("Duplicate or conflicting file records.");
  for (const file of value.files) {
    const folder = file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/")) : ".";
    if (file.folder !== folder) throw new Error(`Incorrect folder for ${file.path}`);
  }
  for (const item of value.imports) {
    if (!paths.has(item.source) || (item.status === "resolved" && (item.target === null || !paths.has(item.target)))) throw new Error("Invalid import endpoint.");
    if (item.status === "unresolved" && item.target !== null) throw new Error("Unresolved import cannot have a target.");
  }
  for (const state of ["resolved", "external", "excluded", "unresolved"] as const) {
    if (coverage.imports[state] !== value.imports.filter((item) => item.status === state).length) throw new Error(`Invalid ${state} import total.`);
  }
  const resolved = value.imports.flatMap((item) => item.status === "resolved" && item.target !== null ? [{ source: item.source, target: item.target, kinds: [item.kind] }] : []);
  const expected = calculateGraph(value.files, resolved);
  if (JSON.stringify(expected.edges) !== JSON.stringify(value.edges) || expected.files.some((file, index) => file.fanIn !== value.files[index].fanIn || file.fanOut !== value.files[index].fanOut)) throw new Error("Graph does not match resolved imports.");
  return value;
}

export async function writeResult(filename: string, result: ParseResult): Promise<void> {
  await writeFile(filename, JSON.stringify(validateResult(result), null, 2) + "\n", { flag: "wx" });
}

export async function readResult(filename: string): Promise<ParseResult> {
  const value: unknown = JSON.parse(await readFile(filename, "utf8"));
  return validateResult(value);
}
