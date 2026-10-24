"use client";

import { memo, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef } from "react";
import { getBezierPath, Position, useViewport, type Edge } from "@xyflow/react";
import { batchEdgeDraws, edgeEndpoints, type EdgePanel, type EdgeConnection } from "@/lib/edge-geometry.mts";

export const GraphEdges = memo(function GraphEdges({ panels, connections, lines, scrollOffsets }: {
  panels: EdgePanel[]; connections: EdgeConnection[]; lines: Edge[]; scrollOffsets: ReadonlyMap<string, number>;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const cachedPaths = useRef<Path2D[]>([]);
  const viewport = useViewport();
  const endpoints = useMemo(() => edgeEndpoints(panels, connections, scrollOffsets), [panels, connections, scrollOffsets]);
  const batches = useMemo(() => batchEdgeDraws(endpoints, lines.map(line => ({
    stroke: String(line.style?.stroke ?? "var(--muted)"),
    opacity: typeof line.style?.opacity === "number" ? line.style.opacity : 1,
  }))), [endpoints, lines]);
  const paths = useMemo(() => batches.map(endpoint => getBezierPath({
    ...endpoint, sourcePosition: Position.Right, targetPosition: Position.Left,
  })[0]), [batches]);

  useLayoutEffect(() => { cachedPaths.current = paths.map(path => new Path2D(path)); }, [paths]);
  const paint = useEffectEvent(() => {
    const element = canvas.current;
    if (!element) return;
    const context = element.getContext("2d");
    if (!context) throw new Error("The dependency map requires a 2D canvas.");
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(element.clientWidth * ratio);
    const height = Math.round(element.clientHeight * ratio);
    if (element.width !== width) element.width = width;
    if (element.height !== height) element.height = height;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, width, height);
    context.setTransform(ratio * viewport.zoom, 0, 0, ratio * viewport.zoom, ratio * viewport.x, ratio * viewport.y);
    const theme = getComputedStyle(element);
    const colors = new Map(["--incoming", "--outgoing", "--muted"].map(name => [`var(${name})`, theme.getPropertyValue(name).trim()]));
    context.lineWidth = 1;
    for (let index = 0; index < batches.length; index++) {
      const { stroke, opacity } = batches[index];
      context.strokeStyle = colors.get(stroke) ?? stroke;
      context.globalAlpha = opacity;
      context.stroke(cachedPaths.current[index]);
    }
  });
  useLayoutEffect(() => { paint(); }, [paths, viewport]);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const redraw = () => paint();
    const resize = new ResizeObserver(redraw);
    resize.observe(element);
    const theme = new MutationObserver(redraw);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", redraw);
    return () => { resize.disconnect(); theme.disconnect(); media.removeEventListener("change", redraw); };
  }, []);
  // Connections have no click action; canvas avoids one store subscriber and
  // SVG subtree per edge while retaining every curve and its individual alpha.
  return <canvas ref={canvas} aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 1 }} />;
});
