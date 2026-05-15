/**
 * Tests para el tool execute_command.
 * Ejecutar: npx vitest run src/tools/__tests__/execute-command.test.ts
 */
import { describe, it, expect } from "vitest";
import { isBlockedCommand } from "../executor";

// ─── Security Blocklist ────────────────────────────────────────

describe("isBlockedCommand", () => {
  it("bloquea format de disco", () => {
    expect(isBlockedCommand("format C:")).not.toBeNull();
    expect(isBlockedCommand("format D:")).not.toBeNull();
  });

  it("bloquea shutdown/reboot", () => {
    expect(isBlockedCommand("shutdown /s")).not.toBeNull();
    expect(isBlockedCommand("shutdown -h now")).not.toBeNull();
    expect(isBlockedCommand("reboot")).not.toBeNull();
  });

  it("bloquea rm -rf en raíz del sistema", () => {
    expect(isBlockedCommand("rm -rf /")).not.toBeNull();
    expect(isBlockedCommand("rm -rf / --no-preserve-root")).not.toBeNull();
  });

  it("bloquea del con flags destructivos en raíz de Windows", () => {
    expect(isBlockedCommand("del /s C:\\")).not.toBeNull();
    expect(isBlockedCommand("del /f C:\\")).not.toBeNull();
  });

  it("bloquea modificación de registro", () => {
    expect(isBlockedCommand("registry delete HKLM\\Software")).not.toBeNull();
    expect(isBlockedCommand("modify registry then delete key")).not.toBeNull();
  });

  it("bloquea mkfs", () => {
    expect(isBlockedCommand("mkfs.ext4 /dev/sda1")).not.toBeNull();
  });

  it("bloquea dd if=", () => {
    expect(isBlockedCommand("dd if=/dev/zero of=/dev/sda")).not.toBeNull();
  });

  // ─── Comandos PERMITIDOS ─────────────────────────────────────

  it("permite npm install", () => {
    expect(isBlockedCommand("npm install")).toBeNull();
  });

  it("permite npm test", () => {
    expect(isBlockedCommand("npm test")).toBeNull();
  });

  it("permite npm run dev", () => {
    expect(isBlockedCommand("npm run dev")).toBeNull();
  });

  it("permite git status", () => {
    expect(isBlockedCommand("git status")).toBeNull();
  });

  it("permite git add .", () => {
    expect(isBlockedCommand("git add .")).toBeNull();
  });

  it("permite git commit", () => {
    expect(isBlockedCommand('git commit -m "feat: new feature"')).toBeNull();
  });

  it("permite rm -rf node_modules (no es raíz)", () => {
    expect(isBlockedCommand("rm -rf node_modules")).toBeNull();
  });

  it("permite npx vitest", () => {
    expect(isBlockedCommand("npx vitest run")).toBeNull();
  });

  it("permite npx tsc --noEmit", () => {
    expect(isBlockedCommand("npx tsc --noEmit")).toBeNull();
  });

  it("permite bun install", () => {
    expect(isBlockedCommand("bun install")).toBeNull();
  });

  it("permite cargo build", () => {
    expect(isBlockedCommand("cargo build")).toBeNull();
  });

  it("permite pip install", () => {
    expect(isBlockedCommand("pip install requests")).toBeNull();
  });
});
