// Chain amounts are u64: integers must never pass through a JS number.
export type Json = null | boolean | number | bigint | string | Json[] | { [key: string]: Json };

/** JSON.parse where every integer literal becomes a bigint; fractions and exponents stay numbers. */
export function parseJson(text: string): Json {
  let i = 0;
  const fail = (what: string): never => {
    throw new SyntaxError(`Invalid JSON: ${what} at ${i}`);
  };
  const ws = () => {
    while (i < text.length && (text[i] === ' ' || text[i] === '\t' || text[i] === '\n' || text[i] === '\r')) i++;
  };
  const literal = (word: string, value: Json): Json => {
    if (text.startsWith(word, i)) {
      i += word.length;
      return value;
    }
    return fail('unexpected token');
  };
  const string = (): string => {
    i++;
    let out = '';
    for (;;) {
      const start = i;
      while (i < text.length && text[i] !== '"' && text[i] !== '\\') {
        if (text.charCodeAt(i) < 0x20) fail('control character in string');
        i++;
      }
      out += text.slice(start, i);
      if (i >= text.length) fail('unterminated string');
      if (text[i] === '"') {
        i++;
        return out;
      }
      const esc = text[i + 1];
      i += 2;
      if (esc === 'u') {
        const hex = text.slice(i, i + 4);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail('bad unicode escape');
        out += String.fromCharCode(parseInt(hex, 16));
        i += 4;
      } else {
        const map: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
        if (!(esc in map)) fail('bad escape');
        out += map[esc];
      }
    }
  };
  const number = (): number | bigint => {
    const match = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(i, i + 400));
    if (!match) return fail('bad number');
    i += match[0].length;
    return match[2] || match[3] ? Number(match[0]) : BigInt(match[0]);
  };
  const value = (depth: number): Json => {
    if (depth > 64) fail('nesting too deep');
    ws();
    const c = text[i];
    if (c === '{') {
      i++;
      const obj: { [key: string]: Json } = {};
      ws();
      if (text[i] === '}') {
        i++;
        return obj;
      }
      for (;;) {
        ws();
        if (text[i] !== '"') fail('expected key');
        const key = string();
        ws();
        if (text[i] !== ':') fail('expected colon');
        i++;
        Object.defineProperty(obj, key, { value: value(depth + 1), enumerable: true, writable: true, configurable: true });
        ws();
        if (text[i] === ',') {
          i++;
          continue;
        }
        if (text[i] === '}') {
          i++;
          return obj;
        }
        fail('expected , or }');
      }
    }
    if (c === '[') {
      i++;
      const arr: Json[] = [];
      ws();
      if (text[i] === ']') {
        i++;
        return arr;
      }
      for (;;) {
        arr.push(value(depth + 1));
        ws();
        if (text[i] === ',') {
          i++;
          continue;
        }
        if (text[i] === ']') {
          i++;
          return arr;
        }
        fail('expected , or ]');
      }
    }
    if (c === '"') return string();
    if (c === 't') return literal('true', true);
    if (c === 'f') return literal('false', false);
    if (c === 'n') return literal('null', null);
    return number();
  };
  const result = value(0);
  ws();
  if (i !== text.length) fail('trailing data');
  return result;
}

/** JSON.stringify that writes bigints as bare integer literals. */
export function stringifyJson(value: unknown): string {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? 'null' : stringifyJson(v))).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const parts = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${JSON.stringify(k)}:${stringifyJson(v)}`);
    return `{${parts.join(',')}}`;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) throw new TypeError('non-finite number');
  return JSON.stringify(value);
}

export function isObject(v: Json | undefined): v is { [key: string]: Json } {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
