import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-2xl border border-line bg-ink-2 px-4 text-base text-paper outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-amber",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
