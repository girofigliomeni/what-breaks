import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware(async (auth, request) => {
  const path = request.nextUrl.pathname;
  const isAuthRoute = path === "/sign-in" || path.startsWith("/sign-in/") || path === "/sign-up" || path.startsWith("/sign-up/");
  const isSessionTask = path === "/session-tasks/choose-organization";
  // A streamed component can already have sent HTML; gate protected requests before rendering.
  if (!isAuthRoute && !isSessionTask) await auth.protect();
}, { signInUrl: "/sign-in", signUpUrl: "/sign-up" });

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
