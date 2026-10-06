"use client";

import { Onboarding } from "@/components/onboarding";
import { PasscodeGate } from "@/components/passcode-gate";
import { Splash } from "@/components/splash";
import { useApp } from "@/components/app-state";

export function Gate({ children }: { children: React.ReactNode }) {
  const { ready, auth, profile } = useApp();
  if (!ready) return <Splash />;
  if (auth.required && !auth.unlocked) return <PasscodeGate />;
  if (!profile.onboarded) return <Onboarding />;
  return children;
}
