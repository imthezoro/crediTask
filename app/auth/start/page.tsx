"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

export default function AuthStartPage() {
  const [message, setMessage] = useState("Redirecting to Google...");

  useEffect(() => {
    const run = async () => {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !anon) {
          setMessage("Supabase is not configured.");
          return;
        }
        const supabase = createClient(url, anon, {
          auth: { persistSession: true, autoRefreshToken: true },
        });

        const current = new URL(window.location.href);
        const provider = (current.searchParams.get("provider") || "google") as "google";
        const redirectTo = current.searchParams.get("redirectTo") || 
          `${window.location.origin}/auth/callback`;

        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo,
            skipBrowserRedirect: false,
            queryParams: { access_type: "offline", prompt: "select_account" },
          },
        });

        if (error) {
          console.error("signInWithOAuth error:", error);
          setMessage(`Failed to start sign-in: ${error.message}`);
          return;
        }

        // If skipBrowserRedirect is false, Supabase will navigate the page.
        // This message is a fallback in case navigation is blocked.
        setMessage("Opening Google sign-in...");
      } catch (e) {
        console.error("Auth start error", e);
        setMessage("Unexpected error during sign-in start.");
      }
    };
    run();
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>PromptOK</h1>
      <p>{message}</p>
    </main>
  );
}
