import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseRepository } from "../parser/index.mts";
import { validateResult } from "../parser/contract.mts";

const root = await mkdtemp(path.join(tmpdir(), "what-breaks-commonjs-"));
const files: Record<string, string> = {
  "package.json": JSON.stringify({ dependencies: { express: "5" } }),
  "entry.js": `import './service/index.js';
const service = require('./service');
require('./service');
require('node:fs');
require('./missing');
require('./asset.css');
require(variable);
function local(require) { require('./not-a-module'); }
const express = require('express');
express().get('/not-extracted', () => {});`,
  "asset.css": "body {}",
  "service/index.js": "exports.run = () => {}; module.exports.stop = () => {}; exports['named'] = 1;",
  "model/item.cjs": "module.exports = { item: 1, run() {}, ['unknown' + suffix]: 2 };",
  "misc.js": "function local(exports, module) { exports.fake = 1; module.exports = 2; }",
};
for (const directory of ["route", "routes", "router", "routers", "controller", "controllers", "middleware", "middlewares", "model", "models", "service", "services"]) files[`${directory}/sample.js`] = "module.exports = () => {};";
for (const [name, content] of Object.entries(files)) {
  await mkdir(path.dirname(path.join(root, name)), { recursive: true });
  await writeFile(path.join(root, name), content);
}
const result = validateResult(await parseRepository(root));
assert.equal(result.adapter, "express");
assert.deepEqual(result.routes, []);
assert.equal(result.edges.length, 1);
assert.deepEqual(result.edges[0], { source: "entry.js", target: "service/index.js", kinds: ["import", "require"] });
assert.deepEqual(result.coverage.imports, { resolved: 3, external: 1, excluded: 1, unresolved: 3 });
assert.equal(result.imports.length, 8);
assert.deepEqual(result.files.find(file => file.path === "service/index.js")?.exports, ["named", "run", "stop"]);
assert.deepEqual(result.files.find(file => file.path === "model/item.cjs")?.exports, ["default", "item", "run"]);
assert.deepEqual(result.files.find(file => file.path === "misc.js")?.exports, []);
for (const [directory, role] of Object.entries({ route: "Routes", routes: "Routes", router: "Routes", routers: "Routes", controller: "Controllers", controllers: "Controllers", middleware: "Middleware", middlewares: "Middleware", model: "Models", models: "Models", service: "Services", services: "Services" })) {
  assert.equal(result.files.find(file => file.path === `${directory}/sample.js`)?.role, role);
}
console.log("Passed CommonJS resolution, mixed imports, edge deduplication, coverage, export names, shadowed bindings and Express roles without routes.");
