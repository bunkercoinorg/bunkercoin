export type Json = null | boolean | number | bigint | string | Json[] | { [key: string]: Json };

const NUMBER = /-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/y;

// JSON.parse, except integers outside the safe range come back as bigint so
// u64 amounts survive. Duplicate keys resolve last-wins, like JSON.parse.
export function parseJson(text: string): Json {
  let i = 0;

  const fail = (msg: string): never => {
    throw new SyntaxError(`${msg} at position ${i}`);
  };

  const ws = () => {
    while (i < text.length) {
      const c = text.charCodeAt(i);
      if (c === 0x20 || c === 0x0a || c === 0x0d || c === 0x09) i++;
      else break;
    }
  };

  const str = (): string => {
    i++;
    let out = '';
    let start = i;
    while (i < text.length) {
      const c = text[i];
      if (c === '"') {
        out += text.slice(start, i);
        i++;
        return out;
      }
      if (c === '\\') {
        out += text.slice(start, i);
        const e = text[i + 1];
        i += 2;
        if (e === 'u') {
          const hex = text.slice(i, i + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail('Bad unicode escape');
          out += String.fromCharCode(parseInt(hex, 16));
          i += 4;
        } else {
          const map: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
          if (!(e in map)) fail('Bad escape');
          out += map[e];
        }
        start = i;
        continue;
      }
      if (c < ' ') fail('Control character in string');
      i++;
    }
    return fail('Unterminated string');
  };

  const num = (): number | bigint => {
    NUMBER.lastIndex = i;
    const m = NUMBER.exec(text);
    if (!m) return fail('Bad number');
    i += m[0].length;
    if (m[2] || m[3]) return Number(m[0]);
    const n = Number(m[0]);
    return Number.isSafeInteger(n) ? n : BigInt(m[0]);
  };

  const lit = <T>(word: string, v: T): T => {
    if (text.startsWith(word, i)) {
      i += word.length;
      return v;
    }
    return fail('Unexpected token');
  };

  const value = (depth: number): Json => {
    if (depth > 512) fail('Nesting too deep');
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
        if (text[i] !== '"') fail('Expected key');
        const key = str();
        ws();
        if (text[i] !== ':') fail('Expected colon');
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
        fail('Expected , or }');
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
        fail('Expected , or ]');
      }
    }
    if (c === '"') return str();
    if (c === 't') return lit('true', true);
    if (c === 'f') return lit('false', false);
    if (c === 'n') return lit('null', null);
    return num();
  };

  const out = value(0);
  ws();
  if (i !== text.length) fail('Unexpected trailing data');
  return out;
}
