import type { Metadata } from "next";
import { ClerkProvider, Show } from "@clerk/nextjs";
import Link from "next/link";
import { AccountButton } from "@/components/account-button";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "What Breaks",
  description: "Explore the structure of your team's code.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Apply the saved preference before paint; system colours are handled by CSS. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('what-breaks-theme');document.documentElement.dataset.theme=t==='light'||t==='dark'?t:'system'}catch{document.documentElement.dataset.theme='system'}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ClerkProvider
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInForceRedirectUrl="/"
          signUpForceRedirectUrl="/"
          taskUrls={{
            "choose-organization": "/session-tasks/choose-organization",
          }}
          appearance={{
            variables: {
              colorPrimary: "var(--accent)",
              colorBackground: "var(--surface)",
              colorForeground: "var(--foreground)",
              colorMutedForeground: "var(--muted)",
              colorInput: "var(--background)",
              colorInputForeground: "var(--foreground)",
              colorBorder: "var(--border)",
              fontFamily: "var(--font-geist-sans)",
              fontSize: "13px",
              borderRadius: "4px",
            },
          }}
        >
          <a className="skip-link" href="#main-content">
            Skip to content
          </a>
          <header className="app-header">
            <Link className="brand" href="/">
              What Breaks
            </Link>
            <div className="header-controls">
              <nav aria-label="Account" className="account-controls">
                <Suspense>
                  <Show when="signed-out">
                    <Link href="/sign-in">Sign in</Link>
                  </Show>
                  <Show when="signed-in">
                    <AccountButton />
                  </Show>
                </Suspense>
              </nav>
            </div>
          </header>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
