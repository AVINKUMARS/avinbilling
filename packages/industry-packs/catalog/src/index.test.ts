import { describe, expect, it } from "vitest";
import { industryPackCatalog, validateIndustryPacks } from "./index.js";

describe("industry pack catalog", () => {
  it("contains complete and uniquely keyed packs", () => {
    expect(validateIndustryPacks()).toBe(true);
    expect(industryPackCatalog).toHaveLength(8);
    expect(new Set(industryPackCatalog.map((pack) => pack.key)).size).toBe(8);
  });

  it("includes usable seeds and workflows for every pack", () => {
    for (const pack of industryPackCatalog) {
      expect(pack.seedItems.length).toBeGreaterThan(0);
      expect(pack.defaultWorkflow.length).toBeGreaterThan(1);
      expect(pack.formulas.length).toBeGreaterThan(0);
    }
  });
});
