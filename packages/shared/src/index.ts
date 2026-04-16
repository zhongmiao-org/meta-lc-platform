export function quoteIdentifier(value: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`Invalid identifier: ${value}`);
  }
  return `"${value}"`;
}

export function quoteLiteral(value: string | number | boolean): string {
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return `'${value.replace(/'/g, "''")}'`;
}

function quoteArray(values: string[]): string {
  return `ARRAY[${values.map((value) => quoteLiteral(value)).join(", ")}]`;
}

export function formatSqlWithParams(
  sql: string,
  params: Array<string | number | boolean | string[]>
): string {
  let finalSql = sql;
  params.forEach((value, index) => {
    const marker = new RegExp(`\\$${index + 1}(?!\\d)`, "g");
    finalSql = finalSql.replace(
      marker,
      Array.isArray(value) ? quoteArray(value) : quoteLiteral(value)
    );
  });
  return finalSql;
}

export function shiftSqlParams(clause: string, startIndex: number): string {
  return clause.replace(/\$(\d+)/g, (_full, index) => {
    return `$${Number(index) + startIndex}`;
  });
}
