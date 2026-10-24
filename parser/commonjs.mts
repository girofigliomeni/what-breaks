import { Node, SyntaxKind, type SourceFile } from "ts-morph";

// A local binding with this spelling is not evidence of a CommonJS operation.
export function isUnboundIdentifier(node: Node, name: string): boolean {
  // JavaScript CommonJS symbols can be synthetic (or absent with noResolve),
  // so inspect lexical bindings as well as checker declarations.
  for (const scope of node.getAncestors()) {
    if (Node.isFunctionDeclaration(scope) || Node.isFunctionExpression(scope) || Node.isArrowFunction(scope) || Node.isMethodDeclaration(scope)) {
      if (scope.getParameters().some(parameter => bindingNames(parameter.getNameNode()).includes(name))) return false;
    }
    if (Node.isCatchClause(scope) && scope.getVariableDeclaration() && bindingNames(scope.getVariableDeclaration()!.getNameNode()).includes(name)) return false;
    if (Node.isBlock(scope) || Node.isSourceFile(scope)) {
      if (scope.getVariableStatements().some(statement => statement.getDeclarations().some(declaration => bindingNames(declaration.getNameNode()).includes(name)))) return false;
    }
  }
  return Node.isIdentifier(node) && node.getText() === name && !node.getSymbol()?.getDeclarations().some(declaration =>
    Node.isVariableDeclaration(declaration) || Node.isParameterDeclaration(declaration) || Node.isBindingElement(declaration)
    || Node.isFunctionDeclaration(declaration) || Node.isClassDeclaration(declaration)
    || Node.isImportClause(declaration) || Node.isImportSpecifier(declaration) || Node.isNamespaceImport(declaration)
    || Node.isImportEqualsDeclaration(declaration));
}

function bindingNames(node: Node): string[] {
  if (Node.isIdentifier(node)) return [node.getText()];
  if (Node.isObjectBindingPattern(node) || Node.isArrayBindingPattern(node)) return node.getElements().flatMap(element => Node.isBindingElement(element) ? bindingNames(element.getNameNode()) : []);
  return [];
}

function member(node: Node): { object: Node; name: string } | undefined {
  if (Node.isPropertyAccessExpression(node)) return { object: node.getExpression(), name: node.getName() };
  if (Node.isElementAccessExpression(node)) {
    const argument = node.getArgumentExpression();
    if (argument && Node.isStringLiteral(argument)) return { object: node.getExpression(), name: argument.getLiteralValue() };
  }
}

function moduleExports(node: Node): boolean {
  const access = member(node);
  return access?.name === "exports" && isUnboundIdentifier(access.object, "module");
}

export function commonJSExports(source: SourceFile): string[] {
  const names = new Set<string>();
  for (const assignment of source.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
    if (assignment.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) continue;
    const left = assignment.getLeft();
    const access = member(left);
    if (access && (isUnboundIdentifier(access.object, "exports") || moduleExports(access.object))) names.add(access.name);
    if (!moduleExports(left)) continue;
    // A whole-module value has a default export. Only explicit object keys
    // establish additional names; variables, spreads and computed keys do not.
    names.add("default");
    const right = assignment.getRight();
    if (!Node.isObjectLiteralExpression(right)) continue;
    for (const property of right.getProperties()) {
      if (!Node.isPropertyAssignment(property) && !Node.isShorthandPropertyAssignment(property) && !Node.isMethodDeclaration(property) && !Node.isGetAccessorDeclaration(property) && !Node.isSetAccessorDeclaration(property)) continue;
      const key = property.getNameNode();
      if (Node.isIdentifier(key) || Node.isStringLiteral(key) || Node.isNumericLiteral(key)) names.add(Node.isStringLiteral(key) ? key.getLiteralValue() : key.getText());
    }
  }
  return [...names].filter(Boolean).sort();
}
