// Runs before every test file. Vitest runs without globals, so React Testing Library cannot clean up on its own.
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// Pages are lazy chunks; the first import of each is transformed on demand, which can take longer than 1s cold.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
  try {
    window.localStorage.clear();
  } catch {
    // node-environment test files have no window
  }
});
