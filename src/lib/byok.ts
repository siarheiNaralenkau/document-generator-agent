/** Synthetic user id for BYOK mode (no GitHub session). */
export const BYOK_USER_ID = "byok";

export type ByokProviderType = "openai" | "azure" | "anthropic";

/** True when both MODEL_URL and MODEL_API_KEY are set (non-empty after trim). */
export function isByokMode(): boolean {
  const url = process.env.MODEL_URL?.trim();
  const key = process.env.MODEL_API_KEY?.trim();
  return Boolean(url && key);
}

/** Maps MODEL_WIRE_API to Copilot SDK provider.wireApi (default: completions). */
export function getByokWireApi(): "completions" | "responses" {
  const w = process.env.MODEL_WIRE_API?.trim().toLowerCase();
  if (w === "responses") return "responses";
  return "completions";
}

/** Maps MODEL_PROVIDER to Copilot SDK provider.type (default: openai). */
export function getByokProviderType(): ByokProviderType {
  const p = process.env.MODEL_PROVIDER?.trim().toLowerCase();
  if (p === "azure" || p === "anthropic" || p === "openai") return p;
  return "openai";
}
