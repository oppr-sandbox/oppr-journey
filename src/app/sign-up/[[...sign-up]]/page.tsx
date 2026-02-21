"use client";

import { SignUp } from "@clerk/nextjs";
import { useState } from "react";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [validated, setValidated] = useState(false);

  const handleValidate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (trimmed.endsWith("@oppr.ai")) {
      setError("");
      setValidated(true);
    } else {
      setError("Only @oppr.ai email addresses are allowed");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      {validated ? (
        <SignUp
          initialValues={{ emailAddress: email.trim().toLowerCase() }}
          afterSignOutUrl="/"
        />
      ) : (
        <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h1 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Sign up for OPPR
          </h1>
          <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
            Enter your @oppr.ai email to get started.
          </p>
          <form onSubmit={handleValidate}>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              placeholder="you@oppr.ai"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              autoFocus
            />
            {error && (
              <p className="mt-2 text-sm text-red-500">{error}</p>
            )}
            <button
              type="submit"
              className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Continue
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
