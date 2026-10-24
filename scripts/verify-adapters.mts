import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseRepository } from "../parser/index.mts";
import { validateResult } from "../parser/contract.mts";
import { taxonomy } from "../adapters/taxonomy.mts";

async function fixture(dependencies: Record<string, string>, files: Record<string, string>) {
  const directory = await mkdtemp(path.join(tmpdir(), "what-breaks-adapters-"));
  for (const [name, content] of Object.entries({ "package.json": JSON.stringify({ dependencies }), ...files })) {
    await mkdir(path.dirname(path.join(directory, name)), { recursive: true });
    await writeFile(path.join(directory, name), content);
  }
  return validateResult(await parseRepository(directory));
}
const next = await fixture({ next: "16", react: "19", "@nestjs/core": "11" }, {
  "app/(site)/blog/[slug]/page.tsx": "export default function Page() { return <main/>; }",
  "app/api/items/[id]/route.ts": "export async function GET() {} export const DELETE = async () => {}; const POST = () => {};",
  "app/(.)intercept/page.tsx": "export default function Page() { return <main/>; }",
  "app/@slot/page.tsx": "export default function Page() { return <main/>; }",
  "app/_private/page.tsx": "export default function Page() { return <main/>; }",
  "app/actions.ts": "'use server'; export async function save() {}",
  "app/inline.ts": "export const save = async () => { 'use server'; };",
  "app/not-action.ts": "export function plain() { console.log('hello'); 'use server'; }",
  "pages/about.tsx": "export default function About() { return <main/>; }",
  "pages/api/dynamic.ts": "export default function handler(req: unknown) {}",
});
assert.equal(next.adapter, "nextjs");
assert.deepEqual(next.routes?.map(route => [route.method, route.pattern]), [["GET", "/blog/[slug]"], ["GET", "/api/items/[id]"], ["DELETE", "/api/items/[id]"], ["GET", "/about"]]);
assert.equal(next.files.find(file => file.path === "app/actions.ts")?.role, "Server actions");
assert.equal(next.files.find(file => file.path === "app/inline.ts")?.role, "Server actions");
assert.notEqual(next.files.find(file => file.path === "app/not-action.ts")?.role, "Server actions");
assert.notEqual(next.files.find(file => file.path === "app/_private/page.tsx")?.role, "Page routes");
const basePath = await fixture({ next: "16" }, { "next.config.ts": "export default {basePath: '/docs'}", "app/page.tsx": "export default function Page() { return <main/>; }" });
assert.deepEqual(basePath.routes, []);
const workspace = await fixture({}, {
  "apps/v4/package.json": JSON.stringify({ dependencies: { next: "16", react: "19" } }),
  "apps/v4/app/(site)/page.tsx": "export default function Page() { return <main/>; }",
  "apps/v4/app/api/items/route.ts": "export async function GET() {}",
  "apps/docs/package.json": JSON.stringify({ dependencies: { next: "16" } }),
  "apps/docs/next.config.ts": "export default { basePath: '/docs' }",
  "apps/docs/app/page.tsx": "export default function Page() { return <main/>; }",
  "packages/examples/package.json": JSON.stringify({ dependencies: { react: "19" } }),
  "packages/examples/app/page.tsx": "export default function Example() { return <main/>; }",
});
assert.equal(workspace.adapter, "nextjs");
assert.deepEqual(workspace.routes?.map(route => [route.method, route.pattern, route.file]), [
  ["GET", "/", "apps/v4/app/(site)/page.tsx"],
  ["GET", "/api/items", "apps/v4/app/api/items/route.ts"],
]);
assert.equal(workspace.files.find(file => file.path === "apps/v4/app/(site)/page.tsx")?.role, "Page routes");
assert.deepEqual(taxonomy.nextjs.slice(0, 3), ["Page routes", "API endpoints", "Server actions"]);
const controller = `import { Controller as C, Get as G, Post } from '@nestjs/common';
@C('cats') export class CatsController {
  @G(':id') find() {}
  @Post() create() {}
  @G(prefix) unknown() {}
}`;
const nest = await fixture({ "@nestjs/core": "11", react: "19" }, {
  "cats.controller.ts": controller,
  "cats.service.ts": "export class CatsService {}",
  "cats.module.ts": "export class CatsModule {}",
  "cats.entity.ts": "export class Cat {}",
  "fake.controller.ts": "function Controller(p: string) {return () => {}}; function Get() {return () => {}}; @Controller('fake') class Fake { @Get() get() {} }",
});
assert.equal(nest.adapter, "nestjs");
assert.deepEqual(nest.routes?.map(route => [route.method, route.pattern]), [["GET", "/cats/:id"], ["POST", "/cats"]]);
assert.deepEqual(nest.files.map(file => file.role), ["Controllers", "Entities", "Modules", "Services", "Controllers"]);
const prefixed = await fixture({ "@nestjs/core": "11" }, { "cats.controller.ts": controller, "main.ts": "app.setGlobalPrefix('api');" });
assert.deepEqual(prefixed.routes, []);
const react = await fixture({ react: "19" }, { "Button.tsx": "export const Button = () => <button/>;", "useThing.ts": "export function useThing() {}" });
assert.equal(react.adapter, "react");
assert.deepEqual(react.files.map(file => file.role), ["Components", "Hooks"]);
const generic = await fixture({}, { "app/page.tsx": "export default function Page() { return <main/>; }" });
assert.equal(generic.adapter, "none");
assert.equal(generic.files[0].role, "Unidentified");
assert.deepEqual(generic.routes, []);
const corrupt = structuredClone(next);
corrupt.routes![0].file = "absent.ts";
assert.throws(() => validateResult(corrupt), /Invalid route/);
console.log("Passed adapter precedence, concrete roles, literal routes, aliases, dynamic omissions, global-prefix omission, generic fallback and route contract validation.");
