"use client";

import { Gate } from "@/components/gate";
import { ReelFeed } from "@/components/reel-feed";
import { Shell } from "@/components/shell";

export default function HomePage() {
  return (
    <Gate>
      <Shell>
        <ReelFeed mode="feed" />
      </Shell>
    </Gate>
  );
}
