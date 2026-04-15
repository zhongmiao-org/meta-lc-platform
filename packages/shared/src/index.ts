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

export function formatSqlWithParams(
  sql: string,
  params: Array<string | number | boolean>
): string {
  let finalSql = sql;
  params.forEach((value, index) => {
    const marker = new RegExp(`\\$${index + 1}(?!\\d)`, "g");
    finalSql = finalSql.replace(marker, quoteLiteral(value));
  });
  return finalSql;
}

export function shiftSqlParams(clause: string, startIndex: number): string {
  return clause.replace(/\$(\d+)/g, (_full, index) => {
    return `$${Number(index) + startIndex}`;
  });
}
