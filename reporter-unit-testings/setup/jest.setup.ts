import { resetSupabaseMock } from "../mocks/supabaseClient";

let warnSpy: jest.SpyInstance;

beforeEach(() => {
  resetSupabaseMock();
  // The reporter services log offline/demo fallbacks with console.warn.
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});
