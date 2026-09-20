import type { Categorizer } from "../types/index.js";
import { KeywordCategorizer } from "./keywordCategorizer.js";

export function createCategorizer(): Categorizer {
  return new KeywordCategorizer();
}

export type { Categorizer };
