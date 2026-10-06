"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Feed" },
  { href: "/saved", label: "Saved" },
  { href: "/settings", label: "Settings" },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center pb-[max(0.7rem,env(safe-area-inset-bottom))]"
      aria-label="Primary"
    >
      <div className="pointer-events-auto flex gap-1 rounded-full border border-line bg-ink/90 p-1 backdrop-blur">
        {LINKS.map((link) => {
          const current = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={current ? "page" : undefined}
              className={`rounded-full px-4 py-2 text-sm ${
                current ? "bg-paper text-ink" : "text-muted hover:text-paper"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
