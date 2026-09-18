export type FormulaVariables = Record<string, number>;

type Token = { type: "number" | "name" | "operator" | "paren" | "comma"; value: string };

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < expression.length) {
    const rest = expression.slice(index);
    const whitespace = rest.match(/^\s+/);
    if (whitespace) { index += whitespace[0].length; continue; }
    const number = rest.match(/^(?:\d+\.?\d*|\.\d+)/);
    if (number) { tokens.push({ type: "number", value: number[0] }); index += number[0].length; continue; }
    const name = rest.match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
    if (name) { tokens.push({ type: "name", value: name[0] }); index += name[0].length; continue; }
    const character = expression[index]!;
    if ("+-*/%".includes(character)) tokens.push({ type: "operator", value: character });
    else if ("()".includes(character)) tokens.push({ type: "paren", value: character });
    else if (character === ",") tokens.push({ type: "comma", value: character });
    else throw new Error(`Unsupported formula character: ${character}`);
    index += 1;
  }
  return tokens;
}

export function evaluateFormula(expression: string, variables: FormulaVariables): number {
  const tokens = tokenize(expression);
  let position = 0;
  const current = () => tokens[position];
  const consume = () => tokens[position++];

  function primary(): number {
    const token = consume();
    if (!token) throw new Error("Unexpected end of formula");
    if (token.type === "number") return Number(token.value);
    if (token.type === "operator" && (token.value === "+" || token.value === "-")) {
      const value = primary();
      return token.value === "-" ? -value : value;
    }
    if (token.type === "paren" && token.value === "(") {
      const value = addition();
      if (consume()?.value !== ")") throw new Error("Missing closing parenthesis");
      return value!;
    }
    if (token.type === "name") {
      if (current()?.value === "(") {
        consume();
        const args: number[] = [];
        if (current()?.value !== ")") {
          do { args.push(addition()); } while (current()?.type === "comma" && Boolean(consume()));
        }
        if (consume()?.value !== ")") throw new Error("Missing function parenthesis");
        if (token.value === "min") return Math.min(...args);
        if (token.value === "max") return Math.max(...args);
        if (token.value === "round") return Math.round(args[0] ?? 0);
        throw new Error(`Unsupported formula function: ${token.value}`);
      }
      const value = variables[token.value];
      if (!Number.isFinite(value)) throw new Error(`Missing numeric variable: ${token.value}`);
      return value as number;
    }
    throw new Error(`Unexpected token: ${token.value}`);
  }

  function multiplication(): number {
    let value = primary();
    while (current()?.type === "operator" && ["*", "/", "%"].includes(current()!.value)) {
      const operator = consume()!.value;
      const right = primary();
      if ((operator === "/" || operator === "%") && right === 0) throw new Error("Division by zero");
      value = operator === "*" ? value * right : operator === "/" ? value / right : value % right;
    }
    return value;
  }

  function addition(): number {
    let value = multiplication();
    while (current()?.type === "operator" && ["+", "-"].includes(current()!.value)) {
      const operator = consume()!.value;
      const right = multiplication();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }

  const result = addition();
  if (position !== tokens.length) throw new Error(`Unexpected token: ${current()?.value}`);
  if (!Number.isFinite(result)) throw new Error("Formula result is not finite");
  return result;
}
