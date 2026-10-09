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
            darkMode: false,
            background: "transparent",
            primaryColor: "#e7f3ff",
            primaryTextColor: "#050505",
            primaryBorderColor: "#1877f2",
            secondaryColor: "#f0f2f5",
            secondaryTextColor: "#050505",
            tertiaryColor: "#e4e6eb",
            tertiaryTextColor: "#050505",
            lineColor: "#1877f2",
            textColor: "#050505",
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
      <pre className="max-h-64 overflow-auto rounded-2xl bg-elevated p-4 text-xs leading-5 text-muted">
        {chart}
      </pre>
    );
  }
  if (!svg) {
    return <div className="h-52 animate-pulse rounded-3xl bg-elevated" aria-hidden />;
  }
  return (
    <div
      className="mermaid-host overflow-x-auto rounded-3xl bg-elevated/80 p-3"
      // Mermaid sanitizes SVG when securityLevel is strict.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
