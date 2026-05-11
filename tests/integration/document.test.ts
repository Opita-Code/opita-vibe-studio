import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Document HTML", () => {
  it("should have the correct Vibe Studio favicons configured", () => {
    // Read the index.html file
    const indexPath = path.join(process.cwd(), "index.html");
    const htmlContent = fs.readFileSync(indexPath, "utf-8");

    // Check for the SVG icon (modern standard)
    expect(htmlContent).toContain('<link rel="icon" type="image/svg+xml" href="/logo-symbol.svg" />');
    
    // Check for the ICO fallback (legacy)
    expect(htmlContent).toContain('<link rel="alternate icon" type="image/x-icon" href="/favicon.ico" />');
  });

  it("should have the correct title", () => {
    const indexPath = path.join(process.cwd(), "index.html");
    const htmlContent = fs.readFileSync(indexPath, "utf-8");
    
    expect(htmlContent).toContain("<title>Vibe Studio</title>");
  });
});
