export function replacer(_: string, value: unknown): unknown {
  if (value instanceof Set) {
    return { __type: 'Set', values: [...value] };
  }
  if (value instanceof Map) {
    return { __type: 'Map', values: [...value] };
  }
  return value;
}

export function reviver(_: string, value: unknown): unknown {
  if (value != null && typeof value === 'object' && '__type' in value) {
    const obj = value as { __type: string; values: unknown[] };
    if (obj.__type === 'Set') {
      return new Set(obj.values);
    }
    if (obj.__type === 'Map') {
      return new Map(obj.values as Array<[unknown, unknown]>);
    }
  }
  return value;
}
