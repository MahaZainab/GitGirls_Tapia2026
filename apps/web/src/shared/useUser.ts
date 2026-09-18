/**
 * Auth stub (assumption A3: real accounts are out of scope). FOUNDATION-owned,
 * read-only for feature agents (A-02). Always returns the same fixed user.
 */
export interface StubUser {
  id: string;
}

const STUB_USER: StubUser = { id: "demo-user" };

export function useUser(): StubUser {
  return STUB_USER;
}
