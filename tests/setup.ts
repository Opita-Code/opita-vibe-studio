import "@testing-library/jest-dom";
import "fake-indexeddb/auto";

if (typeof window !== "undefined") {
  window.URL.createObjectURL = vi.fn();
  window.URL.revokeObjectURL = vi.fn();
}
