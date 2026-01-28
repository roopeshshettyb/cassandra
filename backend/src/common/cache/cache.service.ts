import { Injectable } from '@nestjs/common';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class CacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultExpiryMinutes: number = 180;

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() > entry.expiresAt;
  }

  private cleanupExpired(): void {
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
      }
    }
  }

  set<T>(key: string, value: T, expiryMinutes?: number): void {
    const expiryMs = (expiryMinutes ?? this.defaultExpiryMinutes) * 60 * 1000;
    const expiresAt = Date.now() + expiryMs;

    this.cache.set(key, {
      value,
      expiresAt,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    this.cleanupExpired();
    return this.cache.size;
  }

  getAllKeys(): string[] {
    this.cleanupExpired();
    return Array.from(this.cache.keys());
  }
}
