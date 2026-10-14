/**
 * In-memory replacement for `src/lib/supabase`.
 *
 * jest.config.js maps every import of `lib/supabase` to this file, so the
 * reporter code under test talks to these mocks instead of the real backend.
 */

export type MockResult = {
  data?: unknown;
  error?: unknown;
};

export type QueryRecord = {
  table: string;
  calls: [string, ...unknown[]][];
};

const CHAIN_METHODS = [
  "select",
  "insert",
  "update",
  "upsert",
  "delete",
  "eq",
  "neq",
  "in",
  "is",
  "gt",
  "gte",
  "lt",
  "lte",
  "match",
  "order",
  "limit",
  "range",
] as const;

const tableQueues = new Map<string, MockResult[]>();
let queryLog: QueryRecord[] = [];

function takeResult(table: string) {
  const queue = tableQueues.get(table);
  const next = queue && queue.length > 0 ? queue.shift()! : {};

  return {
    data: next.data ?? null,
    error: next.error ?? null,
  };
}

function createQueryBuilder(table: string) {
  const record: QueryRecord = { table, calls: [] };
  queryLog.push(record);

  const result = takeResult(table);
  const builder: Record<string, unknown> = {};

  for (const method of CHAIN_METHODS) {
    builder[method] = (...args: unknown[]) => {
      record.calls.push([method, ...args]);
      return builder;
    };
  }

  builder.single = () => {
    record.calls.push(["single"]);
    return Promise.resolve(result);
  };

  builder.maybeSingle = () => {
    record.calls.push(["maybeSingle"]);
    return Promise.resolve(result);
  };

  builder.then = (
    onFulfilled?: (value: typeof result) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(onFulfilled, onRejected);

  return builder;
}

export const storageBucket = {
  upload: jest.fn(),
  remove: jest.fn(),
};

export const supabase = {
  from: jest.fn((table: string) => createQueryBuilder(table)),
  rpc: jest.fn(),
  auth: {
    getUser: jest.fn(),
    signUp: jest.fn(),
    signInWithPassword: jest.fn(),
    signOut: jest.fn(),
    updateUser: jest.fn(),
    startAutoRefresh: jest.fn(),
    stopAutoRefresh: jest.fn(),
  },
  storage: {
    from: jest.fn(() => storageBucket),
  },
};

/** Queue responses returned, in order, by `supabase.from(table)` calls. */
export function queueTable(table: string, ...results: MockResult[]) {
  const queue = tableQueues.get(table) ?? [];
  queue.push(...results);
  tableQueues.set(table, queue);
}

/** All recorded `supabase.from(table)` query chains, in call order. */
export function queriesFor(table: string) {
  return queryLog.filter((record) => record.table === table);
}

/** Arguments of every call to `method` within one recorded query chain. */
export function callsOf(record: QueryRecord | undefined, method: string) {
  return (record?.calls ?? [])
    .filter(([name]) => name === method)
    .map(([, ...args]) => args);
}

export const TEST_REPORTER = {
  id: "reporter-user-001",
  email: "reporter@example.com",
  user_metadata: {},
};

export function mockSignedInUser(user: Record<string, unknown> = TEST_REPORTER) {
  supabase.auth.getUser.mockResolvedValue({ data: { user }, error: null });
}

export function mockSignedOut() {
  supabase.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: { message: "Auth session missing!" },
  });
}

export function mockProfileRole(role: string | null) {
  queueTable("profiles", { data: role ? { role } : null });
}

export function resetSupabaseMock() {
  tableQueues.clear();
  queryLog = [];

  supabase.from.mockClear();
  supabase.storage.from.mockClear();
  supabase.rpc.mockReset().mockResolvedValue({ data: null, error: null });

  supabase.auth.getUser.mockReset();
  mockSignedOut();
  supabase.auth.signUp.mockReset();
  supabase.auth.signInWithPassword.mockReset();
  supabase.auth.signOut.mockReset().mockResolvedValue({ error: null });
  supabase.auth.updateUser.mockReset().mockResolvedValue({ data: {}, error: null });

  storageBucket.upload.mockReset().mockResolvedValue({ data: {}, error: null });
  storageBucket.remove.mockReset().mockResolvedValue({ data: [], error: null });
}

resetSupabaseMock();
