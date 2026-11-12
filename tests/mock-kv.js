// In-memory stand-in for the parts of Workers KV the OAuth provider uses.
export class MockKV {
  constructor() {
    this.entries = new Map();
  }

  #live(key) {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiration && entry.expiration * 1000 <= Date.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry;
  }

  async get(key, options) {
    const entry = this.#live(key);
    if (!entry) return null;
    const type = typeof options === 'string' ? options : options?.type;
    return type === 'json' ? JSON.parse(entry.value) : entry.value;
  }

  async put(key, value, options = {}) {
    const expiration = options.expiration
      ?? (options.expirationTtl ? Math.floor(Date.now() / 1000) + options.expirationTtl : undefined);
    this.entries.set(key, { value: String(value), expiration, metadata: options.metadata });
  }

  async delete(key) {
    this.entries.delete(key);
  }

  async list({ prefix = '', limit = 1000, cursor } = {}) {
    const names = [...this.entries.keys()].filter((key) => key.startsWith(prefix) && this.#live(key)).sort();
    const start = cursor ? Number(cursor) : 0;
    const page = names.slice(start, start + limit);
    const complete = start + limit >= names.length;
    return {
      keys: page.map((name) => ({ name, expiration: this.entries.get(name).expiration, metadata: this.entries.get(name).metadata })),
      list_complete: complete,
      cursor: complete ? undefined : String(start + limit),
    };
  }
}
