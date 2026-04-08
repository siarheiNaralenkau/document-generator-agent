# Repository Analysis Contracts (TypeScript Interfaces)

This document formalizes the language-agnostic repository reading output contracts as TypeScript interfaces.

```ts
export type ConnectorType = "github" | "ghe" | "gitlab" | "azure" | "local";

export interface RepoMeta {
  repoName: string;
  branch: string;
  commitSha: string;
  connector: ConnectorType;
  analyzedAt: string; // ISO-8601
}

export type ExclusionReason =
  | "binary"
  | "generated"
  | "dependency-folder"
  | "build-output"
  | "too-large"
  | "unsupported"
  | "permission-denied"
  | "other";

export interface IncludedFile {
  path: string;
  language: string;
  sizeBytes: number;
}

export interface ExcludedFile {
  path: string;
  reason: ExclusionReason;
  details?: string;
}

export interface Inventory {
  includedFiles: IncludedFile[];
  excludedFiles: ExcludedFile[];
  languageStats: Record<string, number>; // language -> file count
}

export interface FileFact {
  filePath: string;
  language: string;
  moduleGuess?: string;
  responsibilities: string[];
}

export type SymbolKind =
  | "class"
  | "interface"
  | "type"
  | "function"
  | "method"
  | "route"
  | "module"
  | "other";

export interface SymbolFact {
  filePath: string;
  symbolName: string;
  kind: SymbolKind;
  visibility?: "public" | "private" | "protected" | "internal" | "unknown";
  parameters?: string[];
  returnType?: string;
}

export interface TraceRef {
  filePath: string;
  startLine?: number;
  endLine?: number;
  symbolName?: string;
}

export interface BehaviorFact {
  behaviorId: string;
  featureCandidate: string;
  action: string;
  condition?: string;
  effect: string;
  validations?: string[];
  errors?: string[];
  traces: TraceRef[];
  confidence: number; // 0..1
}

export interface DependencyFact {
  dependencyName: string;
  dependencyType:
    | "database"
    | "http-api"
    | "queue"
    | "cache"
    | "filesystem"
    | "auth"
    | "messaging"
    | "other";
  evidence: TraceRef[];
}

export interface TraceFact {
  traceId: string;
  featureCandidate: string;
  requirementHint: string;
  references: TraceRef[];
}

export interface FeatureCandidate {
  featureId: string;
  featureName: string;
  summary: string;
  behaviorIds: string[];
  confidence: number; // 0..1
}

export interface FlowEdge {
  from: string; // route/controller/service/module
  to: string;   // route/controller/service/module
  relation: "calls" | "validates" | "persists" | "publishes" | "reads" | "writes";
  evidence: TraceRef[];
}

export interface ContextPack {
  packId: string;
  title: string;
  tokenEstimate: number;
  filePaths: string[];
  summary: string;
  keyFacts: string[];
}

export interface AnalysisQuality {
  coverageScore: number; // 0..1
  ambiguities: string[];
  unresolvedReferences: string[];
}

/**
 * Canonical output after repository reading + intelligence pass.
 * This is the input boundary for Stage 1.
 */
export interface RepositoryAnalysisPackage {
  repoMeta: RepoMeta;
  inventory: Inventory;
  facts: {
    fileFacts: FileFact[];
    symbolFacts: SymbolFact[];
    behaviorFacts: BehaviorFact[];
    dependencyFacts: DependencyFact[];
    traceFacts: TraceFact[];
  };
  featureCandidates: FeatureCandidate[];
  flowHints: FlowEdge[];
  contextPacks: ContextPack[];
  quality: AnalysisQuality;
}
```

## Scope defaults

Repository analysis includes tests and docs by default.

```ts
export interface AnalysisScopeDefaults {
  includeSourceCode: true;
  includeTests: true;
  includeDocs: true;
}
```

