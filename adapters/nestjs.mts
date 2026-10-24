import { Node, SyntaxKind, type Decorator } from "ts-morph";
import type { FrameworkAdapter } from "./index.mts";
import { literal } from "./index.mts";
import { genericRole } from "./taxonomy.mts";
import type { Route } from "../parser/types.mts";

export const nestAdapter: FrameworkAdapter = {
  name: "nestjs", matches: dependencies => dependencies.has("@nestjs/core"),
  // Bootstrap prefixes, versioning and module mounting need more than decorator
  // concatenation. Withhold the table rather than publish partial URL patterns.
  routesRecoverable: sources => !sources.some(source => source.getDescendantsOfKind(SyntaxKind.CallExpression).some(call => {
    const expression = call.getExpression();
    return Node.isPropertyAccessExpression(expression) && (["setGlobalPrefix", "enableVersioning"].includes(expression.getName()) || expression.getExpression().getText() === "RouterModule");
  })),
  inspect({ path, source }) {
    const suffixes = [["controller", "Controllers"], ["service", "Services"], ["module", "Modules"], ["entity", "Entities"]];
    const role = suffixes.find(([suffix]) => path.endsWith(`.${suffix}.ts`) || path.endsWith(`.${suffix}.js`))?.[1] ?? genericRole(path);
    const names = new Map<string, string>();
    for (const declaration of source.getImportDeclarations()) if (declaration.getModuleSpecifierValue() === "@nestjs/common") {
      for (const binding of declaration.getNamedImports()) if (!binding.isTypeOnly() && !declaration.isTypeOnly()) names.set(binding.getAliasNode()?.getText() ?? binding.getName(), binding.getName());
    }
    const name = (decorator: Decorator) => {
      const expression = decorator.getCallExpression()?.getExpression();
      return expression && Node.isIdentifier(expression) ? names.get(expression.getText()) : undefined;
    };
    const argument = (decorator: Decorator): string | undefined => {
      const args = decorator.getArguments();
      return args.length === 0 ? "" : args.length === 1 ? literal(args[0]) : undefined;
    };
    const routes: Route[] = [];
    for (const controller of source.getClasses()) {
      const decorators = controller.getDecorators().filter(decorator => name(decorator) === "Controller");
      if (decorators.length !== 1) continue;
      const prefix = argument(decorators[0]);
      if (prefix === undefined || controller.getDecorators().some(decorator => name(decorator) === "Version")) continue;
      for (const method of controller.getMethods()) {
        const handlers = method.getDecorators().filter(decorator => ["Get", "Post", "Put", "Patch", "Delete", "Head", "Options"].includes(name(decorator) ?? ""));
        if (handlers.length !== 1 || method.getDecorators().some(decorator => name(decorator) === "Version")) continue;
        const tail = argument(handlers[0]);
        if (tail === undefined) continue;
        const pattern = "/" + [prefix, tail].map(part => part.replace(/^\/+|\/+$/g, "")).filter(Boolean).join("/");
        routes.push({ file: path, line: method.getStartLineNumber(), method: name(handlers[0])!.toUpperCase(), pattern });
      }
    }
    return { role, entry: role === "Controllers" || role === "Modules", routes };
  },
};
