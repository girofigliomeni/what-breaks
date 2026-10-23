import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignUpPage() {
  return (
    <main id="main-content" className="auth-page">
      <h1>Join What Breaks</h1>
      <Suspense fallback={<p>Loading sign up…</p>}>
        <SignUp />
      </Suspense>
    </main>
  );
}
