import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Document HTML", () => {
  it("should have the correct Vibe Studio favicons configured", () => {
    const indexPath = path.join(process.cwd(), "index.html");
    const htmlContent = fs.readFileSync(indexPath, "utf-8");

    // Check for the SVG icon (current standard: vibe-logo.svg)
    expect(htmlContent).toContain('<link rel="icon" type="image/svg+xml" href="/vibe-logo.svg" />');
    
    // Check for the Apple touch icon
    expect(htmlContent).toContain('<link rel="apple-touch-icon" href="/vibe-logo.svg" />');
  });

  it("should have the correct title", () => {
    const indexPath = path.join(process.cwd(), "index.html");
    const htmlContent = fs.readFileSync(indexPath, "utf-8");
    
    // Title now includes the full SEO-optimized tagline
    expect(htmlContent).toContain("Vibe Studio");
    expect(htmlContent).toContain("<title>");
  });
});
