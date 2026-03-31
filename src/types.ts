export interface ProviderResponse {
  provider: string;
  text: string;
  latencyMs: number;
  error?: string;
}

export interface FusedCluster {
  members: string[];      // provider names
  representative: string; // longest/clearest response in cluster
  similarity: number;     // avg pairwise similarity within cluster
}

export interface FuseResult {
  consensus: string;
  confidence: number;     // 0-1
  method: "unanimous" | "majority" | "best-effort";
  agreed: string[];       // providers in consensus
  outliers: ProviderResponse[];
  responses: ProviderResponse[];
  total: number;
}
