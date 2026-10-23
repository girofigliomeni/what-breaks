import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignInPage() {
  return (
    <main id="main-content" className="auth-page">
      <h1>Sign in to What Breaks.</h1>
      <Suspense fallback={<p>Loading sign in…</p>}>
        <SignIn />
      </Suspense>
    </main>
  );
}
