import { describe, expect, it } from "vitest";
import { evaluateFormula } from "./formula.js";

describe("safe formula evaluator", () => {
  it("evaluates arithmetic, variables, grouping and approved functions", () => {
    expect(evaluateFormula("width * height / 100", { width: 20, height: 30 })).toBe(6);
    expect(evaluateFormula("max(base, 10) + round(extra)", { base: 8, extra: 2.6 })).toBe(13);
  });

  it("rejects code, missing values and division by zero", () => {
    expect(() => evaluateFormula("process.exit()", {})).toThrow();
    expect(() => evaluateFormula("unknown + 1", {})).toThrow("Missing numeric variable");
    expect(() => evaluateFormula("1 / 0", {})).toThrow("Division by zero");
  });
});
