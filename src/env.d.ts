/// <reference types="astro/client" />

interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean }>;
}

interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
}

declare namespace App {
  interface Locals {
    runtime: {
      env: {
        DB: D1DatabaseLike;
        ADMIN_PASSWORD?: string;
      };
    };
  }
}
