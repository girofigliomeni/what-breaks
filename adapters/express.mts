import type { FrameworkAdapter } from "./index.mts";
import { genericRole } from "./taxonomy.mts";

const directories: Record<string, string> = {
  route: "Routes", routes: "Routes", router: "Routes", routers: "Routes",
  controller: "Controllers", controllers: "Controllers",
  middleware: "Middleware", middlewares: "Middleware",
  model: "Models", models: "Models",
  service: "Services", services: "Services",
};

export const expressAdapter: FrameworkAdapter = {
  name: "express", matches: dependencies => dependencies.has("express"),
  inspect({ path }) {
    const role = path.split("/").slice(0, -1).reverse().map(folder => directories[folder]).find(Boolean) ?? genericRole(path);
    // Router mounting and middleware composition do not establish exact URLs.
    return { role, routes: [] };
  },
};
