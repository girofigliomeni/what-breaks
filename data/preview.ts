import raw from "./preview.json";
import { validateResult } from "@/parser/contract.mts";

// Unmodified parser output; canvas-specific shapes are derived separately.
export const preview = validateResult(raw);
