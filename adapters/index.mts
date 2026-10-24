import { Node, type SourceFile, type Statement } from "ts-morph";
import type { Route } from "../parser/types.mts";
import { genericRole } from "./taxonomy.mts";
import { nextAdapter } from "./nextjs.mts";
import { nestAdapter } from "./nestjs.mts";
import { expressAdapter } from "./express.mts";

export interface AdapterInput {
  path: string;
  source: SourceFile;
  packageRoot?: string;
  packageDependencies?: ReadonlySet<string>;
  packageSources?: readonly SourceFile[];
}
export interface FrameworkAdapter {
  name: string;
  matches(dependencies: ReadonlySet<string>): boolean;
  routesRecoverable?(sources: readonly SourceFile[]): boolean;
  inspect(input: AdapterInput): { role: string; entry?: boolean; routes: Route[] };
}
export function reactRole({ path, source }: AdapterInput): string {
  if (/\.(jsx|tsx)$/.test(path) && source.getDescendants().some(node => Node.isJsxElement(node) || Node.isJsxSelfClosingElement(node) || Node.isJsxFragment(node))) return "Components";
  if (source.getFunctions().some(fn => fn.isExported() && /^use[A-Z]/.test(fn.getName() ?? "")) || source.getVariableStatements().some(statement => statement.isExported() && statement.getDeclarations().some(declaration => /^use[A-Z]/.test(declaration.getName())))) return "Hooks";
  return genericRole(path);
}
const reactAdapter: FrameworkAdapter = {
  name: "react", matches: dependencies => dependencies.has("react"),
  inspect: input => ({ role: reactRole(input), routes: [] }),
};
const genericAdapter: FrameworkAdapter = {
  name: "none", matches: () => true,
  inspect: ({ path }) => ({ role: genericRole(path), routes: [] }),
};
export function detectAdapter(dependencies: ReadonlySet<string>): FrameworkAdapter {
  return [nextAdapter, nestAdapter, expressAdapter, reactAdapter, genericAdapter].find(adapter => adapter.matches(dependencies))!;
}

export function hasDirective(source: { getStatements(): Statement[] }, directive: string): boolean {
  for (const statement of source.getStatements()) {
    if (!Node.isExpressionStatement(statement)) break;
    const expression = statement.getExpression();
    if (!Node.isStringLiteral(expression)) break;
    if (expression.getLiteralValue() === directive) return true;
  }
  return false;
}

export function literal(node: Node | undefined): string | undefined {
  return node && (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) ? node.getLiteralValue() : undefined;
}
