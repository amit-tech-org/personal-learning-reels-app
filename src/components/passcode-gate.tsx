"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/components/app-state";

export function PasscodeGate() {
  const { unlock } = useApp();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <form
        className="w-full max-w-sm"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError(null);
          const message = await unlock(passcode);
          setPending(false);
          if (message) setError(message);
        }}
      >
        <p className="text-[11px] uppercase tracking-[0.22em] text-amber">Private</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight text-paper">This feed is locked.</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Primer is for one person. The passcode stays on the server and only opens a session cookie.
        </p>
        <label className="mt-8 block text-sm text-muted" htmlFor="passcode">
          Passcode
        </label>
        <Input
          id="passcode"
          className="mt-2"
          type="password"
          autoComplete="current-password"
          value={passcode}
          onChange={(event) => setPasscode(event.target.value)}
          required
        />
        {error ? (
          <p className="mt-3 text-sm text-rose" role="alert">
            {error}
          </p>
        ) : null}
        <Button className="mt-6 w-full" type="submit" disabled={pending}>
          {pending ? "Checking…" : "Unlock"}
        </Button>
      </form>
    </main>
  );
}
