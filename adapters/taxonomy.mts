import { fileRole } from "./file-conventions.mts";

const generic = ["Type declarations", "Tests", "Configuration", "Module indexes", "Unidentified"];
export const taxonomy: Record<string, readonly string[]> = {
  nextjs: ["Page routes", "API endpoints", "Server actions", "Layouts", "Components", ...generic],
  nestjs: ["Controllers", "Services", "Modules", "Entities", ...generic],
  express: ["Routes", "Controllers", "Middleware", "Models", "Services", ...generic],
  react: ["Components", "Hooks", ...generic],
  none: generic,
};
export function genericRole(path: string): string {
  const role = fileRole(path);
  return ({ "Type declaration": "Type declarations", Test: "Tests", "Module index": "Module indexes" })[role] ?? role;
}
export function roleOf(file: { path: string; role?: string }): string {
  return file.role ?? genericRole(file.path);
}
