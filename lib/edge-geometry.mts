export const FILE_ROW_HEIGHT = 26;
export const FILE_ROW_LIMIT = 8;
export const FILE_ROWS_TOP = 63;

export interface EdgePanel {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  open: boolean;
  paths: readonly string[];
}

export interface EdgeConnection {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export function fileHandleTop(index: number, fileCount: number, scrollTop: number) {
  const height = Math.min(FILE_ROW_LIMIT, fileCount) * FILE_ROW_HEIGHT;
  return FILE_ROWS_TOP + Math.max(2, Math.min(height - 2, index * FILE_ROW_HEIGHT + FILE_ROW_HEIGHT / 2 - scrollTop));
}

// Every connection is supplied by the existing parser-derived projection.
// Endpoint positions depend on rows, not DOM handles for thousands of files.
export function edgeEndpoints(panels: readonly EdgePanel[], connections: readonly EdgeConnection[], scrollOffsets: ReadonlyMap<string, number>) {
  const indexed = new Map(panels.map(panel => [panel.id, { panel, rows: new Map(panel.paths.map((path, index) => [path, index])) }]));
  function endpoint(id: string, handle: string | null | undefined, source: boolean) {
    const entry = indexed.get(id);
    if (!entry) throw new Error(`Edge panel is absent: ${id}`);
    const { panel, rows } = entry;
    let top = panel.height / 2;
    if (panel.open) {
      const row = handle == null ? undefined : rows.get(handle);
      if (row === undefined) throw new Error(`Edge file is absent from its panel: ${handle}`);
      top = fileHandleTop(row, panel.paths.length, scrollOffsets.get(id) ?? 0);
    }
    return { x: panel.x + (source ? panel.width : 0), y: panel.y + top };
  }
  return connections.map(connection => {
    const source = endpoint(connection.source, connection.sourceHandle, true);
    const target = endpoint(connection.target, connection.targetHandle, false);
    return { id: connection.id, sourceX: source.x, sourceY: source.y, targetX: target.x, targetY: target.y };
  });
}

export function batchEdgeDraws(endpoints: ReturnType<typeof edgeEndpoints>, paints: readonly { stroke: string; opacity: number }[]) {
  if (endpoints.length !== paints.length) throw new Error("Every edge needs a paint style.");
  const batches = new Map<string, typeof endpoints[number] & { stroke: string; opacity: number; count: number }>();
  for (let index = 0; index < endpoints.length; index++) {
    const point = endpoints[index];
    const paint = paints[index];
    const key = JSON.stringify([point.sourceX, point.sourceY, point.targetX, point.targetY, paint.stroke, paint.opacity]);
    const existing = batches.get(key);
    if (existing) existing.count++;
    else batches.set(key, { ...point, ...paint, count: 1 });
  }
  // Hidden rows clamp to the same boundary. Paint their identical curves once,
  // retaining the combined opacity of repeated source-over strokes.
  return [...batches.values()].map(batch => ({ ...batch, opacity: 1 - (1 - batch.opacity) ** batch.count }));
}
