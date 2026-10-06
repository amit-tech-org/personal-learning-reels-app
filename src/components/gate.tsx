"use client";

import { useEffect, useState } from "react";
import { Onboarding } from "@/components/onboarding";
import { PasscodeGate } from "@/components/passcode-gate";
import { Splash } from "@/components/splash";
import { useApp } from "@/components/app-state";

export function Gate({ children }: { children: React.ReactNode }) {
  const { ready, auth, profile } = useApp();
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setWaited(true), 2000);
    return () => window.clearTimeout(timer);
  }, []);
  if (!ready && !waited) return <Splash />;
  if (auth.required && !auth.unlocked) return <PasscodeGate />;
  if (!profile.onboarded) return <Onboarding />;
  return children;
}
