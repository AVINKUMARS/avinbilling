import { describe, expect, it } from "vitest";
import { calculateProjectCosting } from "./costing.js";

describe("project costing", () => {
  it("calculates budget, returns, variations, gross and net profit", () => {
    const result = calculateProjectCosting({
      baseRevenuePaise: 1_000_000,
      budget: { materials: 300_000, labour: 100_000, overhead: 50_000 },
      costs: [
        { category: "material_issue", amountPaise: 320_000, status: "approved" },
        { category: "material_return", amountPaise: 20_000, status: "approved" },
        { category: "labour", amountPaise: 120_000, status: "approved" },
        { category: "general", amountPaise: 30_000, status: "approved" },
        { category: "transport", amountPaise: 10_000, status: "pending" },
      ],
      changes: [{ revenueImpactPaise: 100_000, costImpactPaise: 40_000, status: "approved" }],
    });
    expect(result.revenuePaise).toBe(1_100_000);
    expect(result.actualCostPaise).toBe(490_000);
    expect(result.grossProfitPaise).toBe(640_000);
    expect(result.netProfitPaise).toBe(610_000);
    expect(result.budgetVariancePaise).toBe(-40_000);
  });
});
