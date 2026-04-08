# Stage I/O Contracts (TypeScript Interfaces)

This document defines the formal TypeScript interfaces for Stage 1 and Stage 2 inputs/outputs.
For now, sidecar JSON artifacts are mandatory for debugging and traceability.

```ts
import type {
  RepoMeta,
  DependencyFact,
  TraceFact,
  BehaviorFact,
  FeatureCandidate
} from "./agent-contracts.repository-analysis";
```

Note: The import above is illustrative for contract relationships. This repository currently stores contracts in markdown docs only.

## Stage 1 (Feature-Level Requirement Builder)

```ts
export interface StageConstraints {
  requirementsPerFeatureMin: number; // default: 3
  requirementsPerFeatureMax: number; // default: 7
  singleSentence: boolean;            // default: true
}

export interface StageRunControls {
  modelId: string;
  temperature: number;
  maxTokens: number;
  maxRetries: number;
}

export interface Stage1OutputPaths {
  featureRequirementsTextPath: string; // mandatory artifact
  featureRequirementsJsonPath: string; // mandatory sidecar artifact
}

export interface Stage1Input {
  repoMeta: RepoMeta;
  featureCandidates: FeatureCandidate[];
  behaviorFacts: BehaviorFact[];
  dependencyFacts: DependencyFact[];
  traceFacts: TraceFact[];
  constraints: StageConstraints;
  runControls: StageRunControls;
  promptTemplateVersion: string;
  output: Stage1OutputPaths;
}

export interface FeatureRequirement {
  requirementId: string;       // e.g., FR-001
  featureId: string;
  featureName: string;
  sentence: string;            // one-sentence requirement
  validationRules: string[];
  errorScenarios: string[];
  traceability: {
    classNames?: string[];
    symbols?: string[];
    files: string[];
  };
  confidence: number;          // 0..1
}

export interface Stage1JsonSidecar {
  schemaVersion: "1.0";
  generatedAt: string;         // ISO-8601
  repoMeta: RepoMeta;
  requirements: FeatureRequirement[];
  traceabilityMatrix: Array<{
    requirementId: string;
    featureName: string;
    classOrSymbolRef: string;
    filePath: string;
  }>;
  diagnostics: {
    droppedCandidates: string[];
    ambiguityNotes: string[];
  };
}

export interface Stage1Output {
  textArtifactPath: string;    // same as Stage1Input.output.featureRequirementsTextPath
  jsonSidecarPath: string;     // same as Stage1Input.output.featureRequirementsJsonPath
}
```

## Stage 2 (BRD Builder)

```ts
export type BrdRequiredSection =
  | "Project Overview"
  | "Scope"
  | "Consolidated Functional Requirements"
  | "Use Cases"
  | "Non-Functional Requirements"
  | "Dependencies and Preconditions"
  | "Assumptions & Constraints"
  | "Mermaid Diagrams"
  | "Traceability Matrix"
  | "Open Questions/Risks";

export interface Stage2OutputPaths {
  brdMarkdownPath: string; // mandatory artifact
  brdJsonPath: string;     // mandatory sidecar artifact
}

export interface Stage2Input {
  repoMeta: RepoMeta;
  stage1Json: Stage1JsonSidecar;
  stage1TextPath: string;
  dependencies: DependencyFact[];
  assumptions: string[];
  risks: string[];
  requiredSections: BrdRequiredSection[];
  runControls: StageRunControls;
  promptTemplateVersion: string;
  output: Stage2OutputPaths;
}

export interface BrdUseCase {
  featureName: string;
  given: string;
  when: string;
  then: string;
}

export interface BrdJsonSidecar {
  schemaVersion: "1.0";
  generatedAt: string; // ISO-8601
  repoMeta: RepoMeta;
  sections: Record<BrdRequiredSection, string>;
  useCases: BrdUseCase[];
  mermaidDiagrams: string[];
  traceabilityMatrix: Array<{
    requirementId: string;
    featureName: string;
    mappedBrdSection: BrdRequiredSection;
    filePathHints: string[];
  }>;
  validation: {
    hasAllRequiredSections: boolean;
    missingSections: BrdRequiredSection[];
    hasTraceabilityRows: boolean;
    useCaseCoverageByFeature: Record<string, number>;
  };
}

export interface Stage2Output {
  markdownArtifactPath: string; // same as Stage2Input.output.brdMarkdownPath
  jsonSidecarPath: string;      // same as Stage2Input.output.brdJsonPath
}
```

## Mandatory debug artifact policy

```ts
export interface DebugArtifactPolicy {
  stage1JsonSidecarMandatory: true;
  stage2JsonSidecarMandatory: true;
  retentionDays?: number;
}
```

