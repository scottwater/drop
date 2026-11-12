import crypto from 'node:crypto';

export class MockBucket {
  constructor() {
    this.objects = new Map();
  }

  async put(key, body, options = {}) {
    const stored = normalizeBody(body);
    this.objects.set(key, {
      key,
      body: stored,
      size: stored.byteLength,
      uploaded: new Date(),
      httpMetadata: options.httpMetadata || {},
      etag: crypto.createHash('sha1').update(stored).digest('hex'),
    });
  }

  async head(key) {
    const object = this.objects.get(key);
    if (!object) return null;
    return {
      key: object.key,
      size: object.size,
      uploaded: object.uploaded,
      httpMetadata: object.httpMetadata,
    };
  }

  // Supports the subset of R2's get() options Drop uses: `onlyIf` and `range`
  // passed as request Headers (If-None-Match and `bytes=` ranges).
  async get(key, options = {}) {
    const object = this.objects.get(key);
    if (!object) return null;
    const httpEtag = `"${object.etag}"`;
    const base = {
      key: object.key,
      size: object.size,
      uploaded: object.uploaded,
      httpMetadata: object.httpMetadata,
      httpEtag,
      writeHttpMetadata(headers) {
        for (const [metaKey, value] of Object.entries(object.httpMetadata || {})) {
          if (value) headers.set(metaKey.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`), value);
        }
      },
    };

    if (options.onlyIf?.get?.('if-none-match') === httpEtag) {
      return base;
    }

    let body = object.body;
    let range;
    const rangeHeader = options.range?.get?.('range');
    if (rangeHeader) {
      const [, start, end] = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader) || [];
      if (start === '' && end) {
        range = { suffix: Number(end) };
        body = body.slice(-Number(end));
      } else if (start !== undefined) {
        const offset = Number(start);
        const last = end ? Math.min(Number(end), object.size - 1) : object.size - 1;
        range = { offset, length: last - offset + 1 };
        body = body.slice(offset, last + 1);
      }
    }

    return {
      ...base,
      body,
      range,
      async text() {
        return new TextDecoder().decode(body);
      },
      async arrayBuffer() {
        return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
      },
    };
  }

  async delete(keys) {
    if (Array.isArray(keys)) {
      keys.forEach((key) => this.objects.delete(key));
      return;
    }
    this.objects.delete(keys);
  }

  async list({ prefix = '', delimiter, limit = 1000 } = {}) {
    const all = [...this.objects.values()]
      .filter((object) => object.key.startsWith(prefix))
      .sort((a, b) => a.key.localeCompare(b.key));

    if (!delimiter) {
      const objects = all.slice(0, limit).map((object) => this.#listObject(object));
      return {
        objects,
        delimitedPrefixes: [],
        truncated: all.length > limit,
        cursor: undefined,
      };
    }

    const objects = [];
    const prefixes = new Set();
    for (const object of all) {
      const rest = object.key.slice(prefix.length);
      if (!rest) continue;
      const index = rest.indexOf(delimiter);
      if (index === -1) {
        objects.push(this.#listObject(object));
      } else {
        prefixes.add(prefix + rest.slice(0, index + 1));
      }
    }

    return {
      objects: objects.slice(0, limit),
      delimitedPrefixes: [...prefixes].sort(),
      truncated: false,
      cursor: undefined,
    };
  }

  #listObject(object) {
    return {
      key: object.key,
      size: object.size,
      uploaded: object.uploaded,
      httpMetadata: object.httpMetadata,
    };
  }
}

function normalizeBody(body) {
  if (body instanceof Uint8Array) return body;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (typeof body === 'string') return new TextEncoder().encode(body);
  if (body?.arrayBuffer) {
    throw new Error('Unexpected async body in mock bucket');
  }
  return new TextEncoder().encode(String(body ?? ''));
}
