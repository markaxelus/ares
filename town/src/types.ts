export type BrainNode = {
  id: string;
  type: string;
  title: string;
  summary?: string;
  body?: string;
  tags?: string[];
  confidence?: string;
  source?: string;
  created?: string;
  updated?: string;
  parent?: string;
  order?: number;
  pinned?: boolean;
  tile?: number;
};
export type Edge = {
  id: string;
  from: string;
  to: string;
  rel: string;
  note?: string;
};
export type Brain = {
  nodes: BrainNode[];
  edges: Edge[];
  types: Record<string, { label: string; color: string }>;
  rels: Record<string, string>;
  meta: Record<string, unknown>;
};
export type BrainEvent = {
  kind: string;
  ids: string[];
  source: string;
  timestamp: string;
  sequence?: string;
  dry_run?: boolean;
};
