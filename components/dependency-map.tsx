"use client";

import { createContext, useContext, useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { ReactFlow, ReactFlowProvider, Handle, Position, Controls, useReactFlow, useNodesInitialized, useUpdateNodeInternals, type Node, type NodeProps, type Edge } from "@xyflow/react";
import { fileExtension } from "@/adapters/file-conventions.mts";
import { MapShell } from "./map-shell";
import { DetailPane } from "./detail-pane";
import dagre from "@dagrejs/dagre";
import type { ParseResult } from "@/parser/types.mts";
import { foldFiles, shortLabels } from "@/lib/folding.mts";
import "@xyflow/react/dist/style.css";

type Module = ReturnType<typeof foldFiles>["modules"][number];
type ModuleData = Module & { label: string; open: boolean; toggle: () => void; select: (path: string) => void; active: Set<string> | null; labels: Map<string, string>; selection: string | null; category: string | null };
type ModuleNode = Node<ModuleData, "module">;
const ROW_LIMIT = 8;
const HoverContext = createContext<{ path: string | null; setPath: (path: string | null) => void }>({ path: null, setPath: () => {} });

function ModulePanel({ id, data }: NodeProps<ModuleNode>) {
  const hover = useContext(HoverContext);
  const [scrollTop, setScrollTop] = useState(0);
  const updateNodeInternals = useUpdateNodeInternals();
  const rowHeight = 26;
  const viewportHeight = Math.min(ROW_LIMIT, data.files.length) * rowHeight;
  const remaining = Math.max(0, data.files.length - Math.floor((scrollTop + viewportHeight) / rowHeight));
  useLayoutEffect(() => {
    updateNodeInternals(id);
  }, [id, data.open, scrollTop, updateNodeInternals]);
  return (
    <div className="module-box" data-highlighted={hover.path === id || data.files.some(file => file.path === hover.path)} data-selected={data.selection === id}
      onPointerOver={event => {
        // One owner resolves the deepest row; parent and row handlers cannot compete.
        const target = event.target;
        const row = target instanceof Element ? target.closest<HTMLElement>("[data-file-path]") : null;
        hover.setPath(row?.dataset.filePath ?? id);
      }}
      onPointerLeave={() => hover.setPath(null)}
    >
      <button className="module-header nodrag" onClick={() => { setScrollTop(0); data.toggle(); }} aria-expanded={data.open} title={data.id}>
        <span className="module-label">{data.open ? "−" : "+"} {data.label}</span>
        <span className="module-count">{data.category ? `${data.files.filter(file => fileExtension(file.path) === data.category).length} / ${data.files.length} matched` : `${data.files.length} files`}</span>
        <span className="module-degrees"><span>In {data.fanIn}</span><span>Out {data.fanOut}</span></span>
      </button>
      {!data.open && <><Handle type="target" position={Position.Left} /><Handle type="source" position={Position.Right} /></>}
      {data.open && <div className="module-files nodrag nowheel" style={{ height: viewportHeight }} onScroll={event => setScrollTop(event.currentTarget.scrollTop)} role="region" aria-label={`Files in ${data.id}`} tabIndex={0}>
      {data.files.map(file => <div key={file.path} className="module-row" data-highlighted={hover.path === file.path} data-selected={data.selection === file.path} data-file-path={file.path} style={{ opacity: data.active && !data.active.has(file.path) ? 0.2 : 1 }}>
        <span className="category-swatch" data-extension={fileExtension(file.path)} aria-hidden="true" />
        <button className="nodrag" onClick={event => { event.stopPropagation(); data.select(file.path); }} title={file.path}>{data.labels.get(file.path)}</button>
        <span title="Fan-in">{file.fanIn}</span>
      </div>)}
      </div>}
      {data.open && data.files.length > ROW_LIMIT && <div className="module-row module-overflow">{remaining} more below</div>}
      {data.open && data.files.map((file, index) => {
        // Offscreen endpoints stay at the list boundary rather than leaving the panel.
        const top = 63 + Math.max(2, Math.min(viewportHeight - 2, index * rowHeight + rowHeight / 2 - scrollTop));
        return <span key={file.path}><Handle id={file.path} type="target" position={Position.Left} style={{ top }} /><Handle id={file.path} type="source" position={Position.Right} style={{ top }} /></span>;
      })}
    </div>
  );
}
const nodeTypes = { module: ModulePanel };

function Canvas({ result, name }: { result: ParseResult; name: string }) {
  const { files, edges } = result;
  const folded = useMemo(() => foldFiles(files, edges), [files, edges]);
  const [category, setCategory] = useState<string | null>(null);
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [fitPending, setFitPending] = useState(true);
  const selectFile = useCallback((path: string) => {
    setSelection(path);
    const owner = folded.owners.get(path);
    if (owner) setOpened(previous => new Set([...previous, owner]));
    setFitPending(true);
  }, [folded]);
  const flow = useReactFlow<ModuleNode>();
  const initialized = useNodesInitialized();
  const toggle = useCallback((id: string) => {
    setOpened(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setFitPending(true);
  }, []);
  const { nodes, lines } = useMemo(() => {
    const selectedFiles = selection === null ? null : new Set(folded.modules.find(module => module.id === selection)?.files.map(file => file.path) ?? [selection]);
    let active = selectedFiles ? new Set(selectedFiles) : null;
    if (active && selectedFiles) for (const edge of edges) if (selectedFiles.has(edge.source) || selectedFiles.has(edge.target)) { active.add(edge.source); active.add(edge.target); }
    if (category) active = new Set(files.filter(file => fileExtension(file.path) === category).map(file => file.path));
    const visiblePaths = folded.modules.flatMap(module => opened.has(module.id) ? [module.id, ...module.files.map(file => file.path)] : [module.id]);
    const labels = shortLabels(visiblePaths);
    const graph = new dagre.graphlib.Graph().setGraph({ rankdir: "LR", nodesep: 26, ranksep: 72, marginx: 20, marginy: 20 }).setDefaultEdgeLabel(() => ({}));
    const nodes: ModuleNode[] = folded.modules.map(module => {
      const open = opened.has(module.id);
      const label = labels.get(module.id) ?? module.id;
      const width = Math.max(156, ...[label, ...(open ? module.files.map(file => labels.get(file.path) ?? file.path) : [])].map(label => label.length * 7 + 60));
      const height = open ? 64 + Math.min(ROW_LIMIT, module.files.length) * 26 + (module.files.length > ROW_LIMIT ? 26 : 0) : Math.ceil(64 + Math.sqrt(module.fanIn) * 9);
      graph.setNode(module.id, { width, height });
      return { id: module.id, type: "module", position: { x: 0, y: 0 }, style: { width, height, opacity: active && !module.files.some(file => active.has(file.path)) ? 0.15 : 1 }, data: { ...module, label, open, toggle: () => toggle(module.id), select: selectFile, active, labels, selection, category } };
    });
    const lines: Edge[] = [];
    const seen = new Map<string, Edge>();
    for (const edge of edges) {
      const source = folded.owners.get(edge.source)!;
      const target = folded.owners.get(edge.target)!;
      if (source === target && !opened.has(source)) continue;
      const sourceHandle = opened.has(source) ? edge.source : undefined;
      const targetHandle = opened.has(target) ? edge.target : undefined;
      const id = JSON.stringify([source, sourceHandle, target, targetHandle]);
      const incident = category ? active!.has(edge.source) && active!.has(edge.target) : !selectedFiles || selectedFiles.has(edge.source) || selectedFiles.has(edge.target);
      const style = { opacity: incident ? 0.65 : 0.06, stroke: selectedFiles?.has(edge.target) ? "var(--incoming)" : selectedFiles?.has(edge.source) ? "var(--outgoing)" : "var(--muted)" };
      const existing = seen.get(id);
      if (existing) {
        if (incident) existing.style = style;
        continue;
      }
      const line = { id, source, target, sourceHandle, targetHandle, style };
      seen.set(id, line);
      lines.push(line);
      if (source !== target) graph.setEdge(source, target);
    }
    dagre.layout(graph);
    for (const node of nodes) {
      const placed = graph.node(node.id);
      node.position = { x: placed.x - placed.width / 2, y: placed.y - placed.height / 2 };
    }
    return { nodes, lines };
  }, [folded, files, edges, opened, selection, category, toggle, selectFile]);

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

  return <HoverContext.Provider value={hoverState}><MapShell files={files} category={category} setCategory={setCategory} details={<DetailPane result={result} name={name} selection={selection} modules={folded.modules} hovered={hovered} select={selectFile} hover={setHovered} />}><div className="graph-surface">
    <div className="graph-caption">{name} · {files.length} files · {folded.modules.length} modules</div>
    <ReactFlow<ModuleNode> nodes={nodes} edges={lines} nodeTypes={nodeTypes} minZoom={0.05} maxZoom={2} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} onPaneClick={() => setSelection(null)} onNodeClick={(_, node) => setSelection(node.id)} proOptions={{ hideAttribution: true }}>
      <Controls showInteractive={false} />
    </ReactFlow>
  </div></MapShell></HoverContext.Provider>;
}

export function DependencyMap(props: { result: ParseResult; name: string }) {
  return <ReactFlowProvider><Canvas {...props} /></ReactFlowProvider>;
}
