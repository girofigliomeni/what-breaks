# What Breaks

**Understand a codebase before changing it.**

What Breaks is a developer tool that turns public JavaScript and TypeScript GitHub repositories into interactive dependency maps. It reveals how files connect, what relies on them, and the impact a change could have across a project.

The map is grounded in actual source-code analysis, not AI-generated guesses.

---

## Overview

Modern codebases can be difficult to navigate, particularly when features span multiple files, modules, and indirect dependencies. What Breaks makes that structure visible through a navigable graph built from resolved imports.

The project is designed to help developers explore unfamiliar repositories, understand relationships between modules, and make more informed changes.

## Features

| Feature | Description |
| --- | --- |
| **GitHub repository analysis** | Submit a public GitHub repository URL for analysis. |
| **Source-based dependency graph** | Visualize connections derived from parsed imports rather than inferred relationships. |
| **Interactive module map** | Expand and collapse modules to explore their files and dependencies. |
| **Dependency inspection** | Select files to inspect their incoming and outgoing connections. |
| **Codebase navigation** | Explore file relationships with selection highlighting and file-type filtering. |
| **Analysis progress** | Follow repository analysis runs and revisit saved analyses. |
| **Coverage reporting** | Surface the files included in analysis and limitations in parsing coverage. |
| **Organization-based access** | Keep analyses associated with the relevant workspace or organization. |

---

## Technology Stack

| Technology | Role |
| --- | --- |
| ![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white) | Application framework |
| ![React](https://img.shields.io/badge/React-149ECA?logo=react&logoColor=white) | Interactive user interface |
| ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white) | Application and parser development |
| ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white) | Styling |
| ![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?logo=supabase&logoColor=white) | Database and analysis persistence |
| ![Clerk](https://img.shields.io/badge/Clerk-6C47FF?logo=clerk&logoColor=white) | Authentication and organizations |
| ![React Flow](https://img.shields.io/badge/React_Flow-FF0072?logo=reactflow&logoColor=white) | Interactive dependency visualization |
| ![pnpm](https://img.shields.io/badge/pnpm-F69220?logo=pnpm&logoColor=white) | Package management |

Additional core libraries include **ts-morph** for source analysis and **Dagre** for graph layout.

---

## How It Works

1. **Provide a repository.** Enter the URL of a public JavaScript or TypeScript GitHub repository.
2. **Parse its source.** The analysis pipeline identifies files and resolves supported import relationships.
3. **Build a dependency graph.** Files and their connections are represented as nodes and edges.
4. **Explore the map.** Expand modules, select files, and inspect how dependencies flow through the codebase.

The central design rule is simple: **a dependency connection is displayed only when the parser can establish it from the code.** Unresolved relationships are not invented to make the graph appear complete.

## Project Structure

| Directory | Purpose |
| --- | --- |
| `app/` | Next.js pages, routes, and server actions |
| `components/` | Repository input, graph visualization, and inspection interface |
| `parser/` | Standalone source parser and dependency graph logic |
| `adapters/` | Framework- and file-specific conventions |
| `pipeline/` | GitHub repository retrieval and analysis orchestration |
| `lib/` | Shared utilities and graph presentation logic |
| `supabase/` | Database schema and configuration |
| `docs/` | Project decisions, specifications, and implementation phases |

---

## Design Principles

**Accurate by construction.** Dependency relationships come from source parsing, never language-model speculation.

**Structure over scoring.** The goal is to explain how a repository fits together, not to rate code quality or manufacture issues.

**Transparent coverage.** Missing or unresolved information should be visible rather than silently approximated.

**Focused exploration.** A compact, interactive interface helps developers inspect the parts of a codebase that matter to a change.

## Scope

What Breaks focuses on **public JavaScript and TypeScript repositories**. Private repository access and support for other languages are outside the project's current intended scope.

---

**Author:** [Giro Figliomeni](https://github.com/girofigliomeni)  
**Repository:** [github.com/girofigliomeni/what-breaks](https://github.com/girofigliomeni/what-breaks)
