/**
 * Hermes (React Native) web-API shims for the Sui / Seal / Walrus SDKs.
 *
 * These SDKs target browsers/Node and use web APIs Hermes doesn't fully implement.
 * Each shim is guarded (`typeof … !== 'function'`) so it's a no-op where the
 * runtime already provides the API. MUST be imported after
 * `react-native-get-random-values` (several rely on `crypto.getRandomValues`).
 *
 * Covered:
 *  - crypto.subtle.generateKey/exportKey — Seal's DEM key gen needs 32 random bytes
 *    via WebCrypto even for the pure-JS Hmac256Ctr DEM. (We don't implement AES.)
 *  - AbortSignal.timeout / AbortSignal.any — @mysten/sui's JSON-RPC transport.
 *  - crypto.randomUUID — used by the SDKs for request ids etc.
 *  - structuredClone — used for deep-copying plain config/tx data.
 */
const g: any = globalThis;

// --- crypto.subtle (generateKey + exportKey only) ---
if (g.crypto && typeof g.crypto.subtle === 'undefined') {
  g.crypto.subtle = {
    async generateKey(algorithm: any, _extractable: boolean, usages: string[]) {
      const raw = new Uint8Array(32);
      g.crypto.getRandomValues(raw);
      return { _raw: raw, type: 'secret', extractable: true, algorithm, usages };
    },
    async exportKey(format: string, key: any): Promise<ArrayBuffer> {
      if (format !== 'raw' || !key?._raw) {
        throw new Error('crypto.subtle shim: only raw export of generated keys is supported');
      }
      return key._raw.slice().buffer;
    },
  };
}

// --- crypto.randomUUID (RFC 4122 v4 from getRandomValues) ---
if (g.crypto && typeof g.crypto.randomUUID !== 'function') {
  g.crypto.randomUUID = (): string => {
    const b = new Uint8Array(16);
    g.crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40; // version 4
    b[8] = (b[8] & 0x3f) | 0x80; // variant 10
    const h = Array.from(b, (x: number) => x.toString(16).padStart(2, '0'));
    return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10, 16).join('')}`;
  };
}

// --- AbortSignal.timeout ---
if (typeof AbortSignal !== 'undefined' && typeof (AbortSignal as any).timeout !== 'function') {
  (AbortSignal as any).timeout = (ms: number): AbortSignal => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  };
}

// --- AbortSignal.any ---
if (typeof AbortSignal !== 'undefined' && typeof (AbortSignal as any).any !== 'function') {
  (AbortSignal as any).any = (signals: Iterable<AbortSignal>): AbortSignal => {
    const controller = new AbortController();
    for (const s of signals) {
      if (s.aborted) {
        controller.abort((s as any).reason);
        break;
      }
      s.addEventListener('abort', () => controller.abort((s as any).reason), { once: true });
    }
    return controller.signal;
  };
}

// --- structuredClone (deep clone of plain data / typed arrays / Map / Set / Date) ---
if (typeof g.structuredClone !== 'function') {
  const clone = (obj: any, seen: Map<any, any>): any => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (seen.has(obj)) return seen.get(obj);
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof ArrayBuffer) return obj.slice(0);
    if (ArrayBuffer.isView(obj)) return new (obj.constructor as any)(obj);
    if (obj instanceof Map) {
      const m = new Map();
      seen.set(obj, m);
      for (const [k, v] of obj) m.set(clone(k, seen), clone(v, seen));
      return m;
    }
    if (obj instanceof Set) {
      const s = new Set();
      seen.set(obj, s);
      for (const v of obj) s.add(clone(v, seen));
      return s;
    }
    if (Array.isArray(obj)) {
      const a: any[] = [];
      seen.set(obj, a);
      for (let i = 0; i < obj.length; i++) a[i] = clone(obj[i], seen);
      return a;
    }
    const out: any = {};
    seen.set(obj, out);
    for (const k of Object.keys(obj)) out[k] = clone(obj[k], seen);
    return out;
  };
  g.structuredClone = (obj: any) => clone(obj, new Map());
}

export {};
