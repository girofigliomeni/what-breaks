export function AnalysisContext({ repository, view, commit }: {
  repository: string; view: "Map" | "Progress"; commit?: string | null;
}) {
  return <div className="analysis-context">
    <code className="analysis-repository" title={repository}>{repository}</code>
    <span className="analysis-view">{view}</span>
    {commit ? <span className="analysis-commit">Commit <code title={commit}>{commit.slice(0, 7)}</code></span> : null}
  </div>;
}
