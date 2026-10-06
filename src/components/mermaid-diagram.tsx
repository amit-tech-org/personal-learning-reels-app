"use client";

import { useEffect, useState } from "react";

export function MermaidDiagram({ chart, id }: { chart: string; id: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          fontFamily: "Outfit, ui-sans-serif, sans-serif",
          themeVariables: {
            darkMode: true,
            background: "transparent",
            primaryColor: "#3a2a16",
            primaryTextColor: "#f4ecdc",
            primaryBorderColor: "#e6a23c",
            secondaryColor: "#1b2823",
            secondaryTextColor: "#f4ecdc",
            tertiaryColor: "#241c14",
            tertiaryTextColor: "#f4ecdc",
            lineColor: "#e6a23c",
            textColor: "#f4ecdc",
            fontSize: "15px",
          },
        });
        const safeId = `m${id.replace(/[^a-zA-Z0-9]/g, "")}${Math.floor(Math.random() * 1e6)}`;
        const result = await mermaid.render(safeId, chart);
        if (!cancelled) setSvg(result.svg);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    void render();
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (failed) {
    return (
      <pre className="max-h-64 overflow-auto rounded-2xl bg-ink-3 p-4 text-xs leading-5 text-muted">
        {chart}
      </pre>
    );
  }
  if (!svg) {
    return <div className="h-52 animate-pulse rounded-3xl bg-ink-3" aria-hidden />;
  }
  return (
    <div
      className="mermaid-host overflow-x-auto rounded-3xl bg-ink-3/80 p-3"
      // Mermaid sanitizes SVG when securityLevel is strict.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
