"use client";

import { Gate } from "@/components/gate";
import { SettingsScreen } from "@/components/settings-screen";
import { Shell } from "@/components/shell";

export default function SettingsPage() {
  return (
    <Gate>
      <Shell>
        <SettingsScreen />
      </Shell>
    </Gate>
  );
}
