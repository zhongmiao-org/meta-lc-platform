import { Injectable } from "@nestjs/common";

export interface CacheHit<T> {
  value: T;
  cached: boolean;
}

@Injectable()
export class CacheService {
  private readonly store = new Map<string, unknown>();

  get<T>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }

  set<T>(key: string, value: T): T {
    this.store.set(key, value);
    return value;
  }

  async remember<T>(key: string, loader: () => Promise<T> | T): Promise<CacheHit<T>> {
    const existing = this.get<T>(key);
    if (existing !== undefined) {
      return { value: existing, cached: true };
    }
    const value = await loader();
    this.set(key, value);
    return { value, cached: false };
  }

  clear(): void {
    this.store.clear();
  }
}
