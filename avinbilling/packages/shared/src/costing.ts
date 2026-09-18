export type ProjectCostCategory =
  | "labour"
  | "subcontractor"
  | "transport"
  | "installation"
  | "site"
  | "general"
  | "miscellaneous"
  | "material_issue"
  | "material_return";

export type ProjectCostingInput = {
  baseRevenuePaise: number;
  budget: Record<string, number>;
  costs: Array<{ category: ProjectCostCategory; amountPaise: number; status: string }>;
  changes: Array<{ revenueImpactPaise: number; costImpactPaise: number; status: string }>;
  committedPurchasePaise?: number;
};

export function calculateProjectCosting(input: ProjectCostingInput) {
  const approvedChanges = input.changes.filter((change) => change.status === "approved");
  const approvedCosts = input.costs.filter((cost) => cost.status === "approved");
  const variationRevenuePaise = approvedChanges.reduce((sum, change) => sum + change.revenueImpactPaise, 0);
  const variationCostPaise = approvedChanges.reduce((sum, change) => sum + change.costImpactPaise, 0);
  const signedCost = (cost: ProjectCostingInput["costs"][number]) => cost.category === "material_return" ? -cost.amountPaise : cost.amountPaise;
  const overheadCategories: ProjectCostCategory[] = ["general", "miscellaneous"];
  const directCostPaise = approvedCosts.filter((cost) => !overheadCategories.includes(cost.category)).reduce((sum, cost) => sum + signedCost(cost), 0) + variationCostPaise;
  const overheadPaise = approvedCosts.filter((cost) => overheadCategories.includes(cost.category)).reduce((sum, cost) => sum + signedCost(cost), 0);
  const actualCostPaise = directCostPaise + overheadPaise;
  const estimatedCostPaise = Object.values(input.budget).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  const revenuePaise = input.baseRevenuePaise + variationRevenuePaise;
  const grossProfitPaise = revenuePaise - directCostPaise;
  const netProfitPaise = revenuePaise - actualCostPaise;
  return {
    baseRevenuePaise: input.baseRevenuePaise,
    variationRevenuePaise,
    revenuePaise,
    estimatedCostPaise,
    directCostPaise,
    overheadPaise,
    actualCostPaise,
    committedPurchasePaise: input.committedPurchasePaise ?? 0,
    budgetVariancePaise: estimatedCostPaise - actualCostPaise,
    grossProfitPaise,
    netProfitPaise,
    grossMarginPercent: revenuePaise ? Math.round(grossProfitPaise / revenuePaise * 1000) / 10 : 0,
    netMarginPercent: revenuePaise ? Math.round(netProfitPaise / revenuePaise * 1000) / 10 : 0,
    pendingCostPaise: input.costs.filter((cost) => cost.status === "pending").reduce((sum, cost) => sum + signedCost(cost), 0),
  };
}
