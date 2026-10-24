"use client";

import { createContext, memo, useContext, useCallback, useEffect, useMemo, useState } from "react";
import { ReactFlow, ReactFlowProvider, Handle, Position, Controls, useReactFlow, useNodesInitialized, type Node, type NodeProps, type Edge } from "@xyflow/react";
import { fileExtension } from "@/adapters/file-conventions.mts";
import { roleOf } from "@/adapters/taxonomy.mts";
import { MapShell } from "./map-shell";
import { DetailPane } from "./detail-pane";
import { GraphEdges } from "./graph-edges";
import dagre from "@dagrejs/dagre";
import type { ParseResult } from "@/parser/types.mts";
import { foldFiles, shortLabels } from "@/lib/folding.mts";
import { FILE_ROW_LIMIT, FILE_ROW_HEIGHT, fileHandleTop } from "@/lib/edge-geometry.mts";
import { spacePanels } from "@/lib/panel-spacing.mts";
import "@xyflow/react/dist/style.css";

type Module = ReturnType<typeof foldFiles>["modules"][number];
type ModuleData = Module & { label: string; open: boolean; toggle: () => void; select: (path: string) => void; scroll: (id: string, top: number) => void; active: Set<string> | null; labels: Map<string, string>; selection: string | null; category: string | null };
type ModuleNode = Node<ModuleData, "module">;
const ROW_LIMIT = FILE_ROW_LIMIT;
const HoverContext = createContext<{ path: string | null; setPath: (path: string | null) => void }>({ path: null, setPath: () => {} });
const noFlowEdges: Edge[] = [];

const FileHandles = memo(function FileHandles({ path, top }: { path: string; top: number }) {
  return <span data-endpoint-file={path}><span className="react-flow__handle react-flow__handle-left" style={{ top }} /><span className="react-flow__handle react-flow__handle-right" style={{ top }} /></span>;
});

function ModulePanel({ id, data }: NodeProps<ModuleNode>) {
  const hover = useContext(HoverContext);
  const localHover = hover.path === id || data.files.some(file => file.path === hover.path) ? hover.path : null;
  return <ModuleContent key={`${id}:${data.open}`} id={id} data={data} hovered={localHover} setHover={hover.setPath} />;
}

const ModuleContent = memo(function ModuleContent({ id, data, hovered, setHover }: {
  id: string; data: ModuleData; hovered: string | null; setHover: (path: string | null) => void;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const rowHeight = FILE_ROW_HEIGHT;
  const viewportHeight = Math.min(ROW_LIMIT, data.files.length) * rowHeight;
  const remaining = Math.max(0, data.files.length - Math.floor((scrollTop + viewportHeight) / rowHeight));
  const firstRow = Math.max(0, Math.floor(scrollTop / rowHeight) - 1);
  const lastRow = Math.min(data.files.length, firstRow + ROW_LIMIT + 2);
  return (
    <div className="module-box" data-highlighted={hovered !== null} data-selected={data.selection === id}
      onPointerOver={event => {
        // One owner resolves the deepest row; parent and row handlers cannot compete.
        const target = event.target;
        const row = target instanceof Element ? target.closest<HTMLElement>("[data-file-path]") : null;
        setHover(row?.dataset.filePath ?? id);
      }}
      onPointerLeave={() => setHover(null)}
    >
      <button className="module-header nodrag" onClick={() => { setScrollTop(0); data.scroll(id, 0); data.toggle(); }} aria-expanded={data.open} title={data.id}>
        <span className="module-label">{data.open ? "-" : "+"} {data.label}</span>
        <span className="module-count">{data.category ? `${data.files.filter(file => roleOf(file) === data.category).length} / ${data.files.length} matched` : `${data.files.length} files`}</span>
        <span className="module-degrees"><span>In {data.fanIn}</span><span>Out {data.fanOut}</span></span>
      </button>
      {!data.open && <><Handle type="target" position={Position.Left} /><Handle type="source" position={Position.Right} /></>}
      {data.open && <div className="module-files nodrag nowheel" style={{ height: viewportHeight }} onScroll={event => { const top = event.currentTarget.scrollTop; setScrollTop(top); data.scroll(id, top); }} role="region" aria-label={`Files in ${data.id}`} tabIndex={0}>
      <div style={{ height: data.files.length * rowHeight, paddingTop: firstRow * rowHeight, boxSizing: "border-box" }}>
      {data.files.slice(firstRow, lastRow).map(file => <div key={file.path} className="module-row" data-highlighted={hovered === file.path} data-selected={data.selection === file.path} data-file-path={file.path} style={{ opacity: data.active && !data.active.has(file.path) ? 0.2 : 1 }}>
        <span className="category-swatch" data-extension={fileExtension(file.path)} aria-hidden="true" />
        <button className="nodrag" onClick={event => { event.stopPropagation(); data.select(file.path); }} title={file.path}>{data.labels.get(file.path)}</button>
        <span title="Fan-in">{file.fanIn}</span>
      </div>)}
      </div>
      </div>}
      {data.open && data.files.length > ROW_LIMIT && <div className="module-row module-overflow">{remaining} more below</div>}
      {data.open && data.files.slice(firstRow, lastRow).map((file, offset) => {
        // Offscreen endpoints stay at the list boundary rather than leaving the panel.
        const top = fileHandleTop(firstRow + offset, data.files.length, scrollTop);
        return <FileHandles key={file.path} path={file.path} top={top} />;
      })}
    </div>
  );
});
const nodeTypes = { module: ModulePanel };

function Canvas({ result, name, commit }: { result: ParseResult; name: string; commit?: string | null }) {
  const { files, edges } = result;
  const folded = useMemo(() => foldFiles(files, edges), [files, edges]);
  const [category, setCategory] = useState<string | null>(null);
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [fitPending, setFitPending] = useState(true);
  const [scrollOffsets, setScrollOffsets] = useState<ReadonlyMap<string, number>>(new Map());
  const scroll = useCallback((id: string, top: number) => {
    setScrollOffsets(previous => (previous.get(id) ?? 0) === top ? previous : new Map(previous).set(id, top));
  }, []);
  const selectFile = useCallback((path: string) => {
    setSelection(path);
    const owner = folded.owners.get(path);
    if (owner) {
      if (!opened.has(owner)) setScrollOffsets(new Map());
      setOpened(previous => previous.size === 1 && previous.has(owner) ? previous : new Set([owner]));
    }
    setFitPending(true);
  }, [folded, opened]);
  const flow = useReactFlow<ModuleNode>();
  const initialized = useNodesInitialized();
  const toggle = useCallback((id: string) => {
    setScrollOffsets(new Map());
    setOpened(previous => previous.has(id) ? new Set() : new Set([id]));
    setFitPending(true);
  }, []);
  // The expensive rank/order calculation belongs to the repository, not clicks.
  const baseline = useMemo(() => {
    const labels = shortLabels(folded.modules.map(module => module.id));
    const graph = new dagre.graphlib.Graph().setGraph({ rankdir: "LR", nodesep: 26, ranksep: 72, marginx: 20, marginy: 20 }).setDefaultEdgeLabel(() => ({}));
    for (const folder of folded.modules) {
      graph.setNode(folder.id, {
        width: Math.max(156, (labels.get(folder.id) ?? folder.id).length * 7 + 60),
        height: Math.ceil(64 + Math.sqrt(folder.fanIn) * 9),
      });
    }
    for (const edge of edges) {
      const source = folded.owners.get(edge.source)!;
      const target = folded.owners.get(edge.target)!;
      if (source !== target) graph.setEdge(source, target);
    }
    dagre.layout(graph);
    return folded.modules.map(module => {
      const placed = graph.node(module.id);
      return { id: module.id, x: placed.x - placed.width / 2, y: placed.y - placed.height / 2, width: placed.width, height: placed.height };
    });
  }, [folded, edges]);

  const layout = useMemo(() => {
    const visiblePaths = folded.modules.flatMap(module => opened.has(module.id) ? [module.id, ...module.files.map(file => file.path)] : [module.id]);
    const labels = shortLabels(visiblePaths);
    const nodes: ModuleNode[] = folded.modules.map(module => {
      const open = opened.has(module.id);
      const label = labels.get(module.id) ?? module.id;
      const width = Math.max(156, ...[label, ...(open ? module.files.map(file => labels.get(file.path) ?? file.path) : [])].map(label => label.length * 7 + 60));
      const height = open ? 64 + Math.min(ROW_LIMIT, module.files.length) * 26 + (module.files.length > ROW_LIMIT ? 26 : 0) : Math.ceil(64 + Math.sqrt(module.fanIn) * 9);
      return { id: module.id, type: "module", position: { x: 0, y: 0 }, style: { width, height }, data: { ...module, label, open, toggle: () => toggle(module.id), select: selectFile, scroll, active: null, labels, selection: null, category: null } };
    });
    const lines: (Edge & { members: ParseResult["edges"] })[] = [];
    const seen = new Map<string, typeof lines[number]>();
    for (const edge of edges) {
      const source = folded.owners.get(edge.source)!;
      const target = folded.owners.get(edge.target)!;
      if (source === target && !opened.has(source)) continue;
      const sourceHandle = opened.has(source) ? edge.source : undefined;
      const targetHandle = opened.has(target) ? edge.target : undefined;
      const id = JSON.stringify([source, sourceHandle, target, targetHandle]);
      const existing = seen.get(id);
      if (existing) {
        existing.members.push(edge);
        continue;
      }
      const line = { id, source, target, sourceHandle, targetHandle, members: [edge] };
      seen.set(id, line);
      lines.push(line);
    }
    const positions = spacePanels(baseline, nodes.map(node => ({ id: node.id, width: Number(node.style?.width), height: Number(node.style?.height) })));
    for (const node of nodes) {
      node.position = positions.get(node.id)!;
    }
    return { nodes, lines };
  }, [baseline, folded, edges, opened, toggle, selectFile, scroll]);

  const edgePanels = useMemo(() => layout.nodes.map(node => ({
    id: node.id, x: node.position.x, y: node.position.y,
    width: Number(node.style?.width), height: Number(node.style?.height),
    open: node.data.open, paths: node.data.files.map(file => file.path),
  })), [layout]);

  const { nodes, lines } = useMemo(() => {
    const selectedFiles = selection === null ? null : new Set(folded.modules.find(module => module.id === selection)?.files.map(file => file.path) ?? [selection]);
    let active = selectedFiles ? new Set(selectedFiles) : null;
    if (active && selectedFiles) for (const edge of edges) if (selectedFiles.has(edge.source) || selectedFiles.has(edge.target)) { active.add(edge.source); active.add(edge.target); }
    if (category) active = new Set(files.filter(file => roleOf(file) === category).map(file => file.path));
    const nodes = layout.nodes.map(node => ({ ...node, style: { ...node.style, opacity: active && !node.data.files.some(file => active.has(file.path)) ? 0.15 : 1 }, data: { ...node.data, active, selection, category } }));
    const lines: Edge[] = layout.lines.map(({ members, ...line }) => {
      let style: Edge["style"];
      for (const edge of members) {
        const incident = category ? active!.has(edge.source) && active!.has(edge.target) : !selectedFiles || selectedFiles.has(edge.source) || selectedFiles.has(edge.target);
        if (!style || incident) style = { opacity: incident ? 0.65 : 0.06, stroke: selectedFiles?.has(edge.target) ? "var(--incoming)" : selectedFiles?.has(edge.source) ? "var(--outgoing)" : "var(--muted)" };
      }
      return { ...line, style };
    });
    return { nodes, lines };
  }, [layout, folded, files, edges, selection, category]);

  // Hover never enters React Flow's controlled nodes or triggers its node updates.
  const hoverState = useMemo(() => ({ path: hovered, setPath: setHovered }), [hovered]);

  useEffect(() => {
    if (!initialized || !fitPending) return;
    // Wait until React Flow has measured the expanded panels, then only zoom out.
    let frame = 0;
    const fit = () => {
      const measured = flow.getNodes();
      if (measured.some(node => node.measured?.height !== node.style?.height || node.measured?.width !== node.style?.width)) {
        frame = requestAnimationFrame(fit);
        return;
      }
      void flow.fitView({ padding: 0.08, maxZoom: Math.min(1, flow.getZoom()), duration: 0 });
      setFitPending(false);
    };
    frame = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(frame);
  }, [initialized, fitPending, nodes, flow]);

  return <HoverContext.Provider value={hoverState}><MapShell adapter={result.adapter} files={files} category={category} setCategory={setCategory} details={<DetailPane result={result} name={name} selection={selection} modules={folded.modules} hovered={hovered} select={selectFile} hover={setHovered} />}><div className="graph-surface">
    <div className="graph-caption"><span>{name}, {files.length} files, {folded.modules.length} modules</span>{commit ? <span className="graph-commit">Commit <code title={commit}>{commit.slice(0, 7)}</code></span> : null}</div>
    <ReactFlow<ModuleNode> nodes={nodes} edges={noFlowEdges} nodeTypes={nodeTypes} minZoom={0.05} maxZoom={2} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} onPaneClick={() => setSelection(null)} onNodeClick={(_, node) => setSelection(node.id)} proOptions={{ hideAttribution: true }}>
      <GraphEdges panels={edgePanels} connections={layout.lines} lines={lines} scrollOffsets={scrollOffsets} />
      <Controls showInteractive={false} />
    </ReactFlow>
  </div></MapShell></HoverContext.Provider>;
}

export function DependencyMap(props: { result: ParseResult; name: string; commit?: string | null }) {
  return <ReactFlowProvider><Canvas {...props} /></ReactFlowProvider>;
}
