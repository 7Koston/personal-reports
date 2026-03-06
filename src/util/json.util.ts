export function replacer(_: string, value: unknown): unknown {
  if (value instanceof Set) {
    return { __type: 'Set', values: [...value] };
  }
  if (value instanceof Map) {
    return { __type: 'Map', values: [...value] };
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object';
}

function isSerializedSet(value: unknown): value is {
  __type: 'Set';
  values: unknown[];
} {
  if (!isRecord(value)) {
    return false;
  }

  return value.__type === 'Set' && Array.isArray(value.values);
}

function isSerializedMap(value: unknown): value is {
  __type: 'Map';
  values: unknown[];
} {
  if (!isRecord(value)) {
    return false;
  }

  return value.__type === 'Map' && Array.isArray(value.values);
}

function toMapEntries(values: unknown[]): Array<[unknown, unknown]> {
  const entries: Array<[unknown, unknown]> = [];

  for (const value of values) {
    if (!Array.isArray(value) || value.length !== 2) {
      continue;
    }

    entries.push([value[0], value[1]]);
  }

  return entries;
}

export function reviver(_: string, value: unknown): unknown {
  if (isSerializedSet(value)) {
    return new Set(value.values);
  }

  if (isSerializedMap(value)) {
    return new Map(toMapEntries(value.values));
  }

  return value;
}
