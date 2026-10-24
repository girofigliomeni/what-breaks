export interface PanelBox { id: string; x: number; y: number; width: number; height: number }
export interface PanelSize { id: string; width: number; height: number }

// Dagre chooses rank/order once. Expansion only changes rectangle spacing;
// it cannot change graph topology or require another crossing-minimization pass.
export function spacePanels(baseline: readonly PanelBox[], sizes: readonly PanelSize[]) {
  const current = new Map(sizes.map(size => [size.id, size]));
  const columns = new Map<number, PanelBox[]>();
  for (const panel of baseline) {
    const center = panel.x + panel.width / 2;
    const column = columns.get(center) ?? [];
    column.push(panel);
    columns.set(center, column);
  }
  const positions = new Map<string, { x: number; y: number }>();
  let right = -Infinity;
  for (const [center, column] of [...columns].sort(([a], [b]) => a - b)) {
    const width = Math.max(...column.map(panel => {
      const size = current.get(panel.id);
      if (!size) throw new Error(`Panel size is absent: ${panel.id}`);
      return size.width;
    }));
    const baseWidth = Math.max(...column.map(panel => panel.width));
    const left = Math.max(center - baseWidth / 2, right + 72);
    let bottom = -Infinity;
    for (const panel of [...column].sort((a, b) => a.y - b.y || a.id.localeCompare(b.id))) {
      const size = current.get(panel.id)!;
      const top = Math.max(panel.y, bottom + 26);
      positions.set(panel.id, { x: left + (width - size.width) / 2, y: top });
      bottom = top + size.height;
    }
    right = left + width;
  }
  return positions;
}
