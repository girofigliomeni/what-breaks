export async function register() {
  const { getEnvironment } = await import("./lib/env");
  getEnvironment();
}
