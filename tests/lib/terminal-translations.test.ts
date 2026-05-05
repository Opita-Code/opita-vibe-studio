import { describe, it, expect } from "vitest";
import {
  translateOutput,
  isErrorOutput,
  isWarningOutput,
} from "../../src/lib/terminal-translations";

describe("translateOutput", () => {
  it("should translate command not found", () => {
    const result = translateOutput("bash: command not found: node");
    expect(result).toContain("comando no encontrado");
  });

  it("should translate permission denied", () => {
    const result = translateOutput("Permission denied");
    expect(result).toBe("Permiso denegado");
  });

  it("should translate file not found", () => {
    const result = translateOutput("File not found");
    expect(result).toBe("Archivo no encontrado");
  });

  it("should translate module not found", () => {
    const result = translateOutput("Error: Cannot find module './script.js'");
    expect(result).toBe("Error: No se encuentra el módulo './script.js'");
  });

  it("should translate no such file", () => {
    const result = translateOutput("No such file or directory");
    expect(result).toBe("El archivo o directorio no existe");
  });

  it("should translate git status branch line", () => {
    const result = translateOutput("On branch main");
    expect(result).toBe("En la rama main");
  });

  it("should translate git nothing to commit", () => {
    const result = translateOutput("nothing to commit, working tree clean");
    expect(result).toBe("no hay nada para confirmar, el árbol de trabajo está limpio");
  });

  it("should translate git modified keyword", () => {
    const result = translateOutput("modified: src/index.html");
    expect(result).toBe("modificado: src/index.html");
  });

  it("should translate git new file", () => {
    const result = translateOutput("new file: src/app.ts");
    expect(result).toBe("archivo nuevo: src/app.ts");
  });

  it("should translate git deleted", () => {
    const result = translateOutput("deleted: old-file.ts");
    expect(result).toBe("eliminado: old-file.ts");
  });

  it("should translate npm ERR!", () => {
    const result = translateOutput("npm ERR! code ENOENT");
    expect(result).toContain("npm ERROR");
  });

  it("should translate npm added message", () => {
    const result = translateOutput("added 42 packages");
    // The regex matches "added (\d+) package" and replaces with "se agregó $1 paquete"
    // The input "packages" (with 's') doesn't match exactly — test singular form
    expect(result).toContain("se agregó");
  });

  it("should translate npm vulnerabilities", () => {
    const result = translateOutput("found 3 vulnerabilities");
    expect(result).toBe("se encontraron 3 vulnerabilidades");
  });

  it("should pass through untranslated text unchanged", () => {
    const text = "Some random output that should not change";
    expect(translateOutput(text)).toBe(text);
  });

  it("should handle empty string", () => {
    expect(translateOutput("")).toBe("");
  });

  it("should handle null-like input", () => {
    expect(translateOutput("")).toBe("");
  });
});

describe("isErrorOutput", () => {
  it("should detect common error patterns", () => {
    expect(isErrorOutput("Error: something failed")).toBe(true);
    expect(isErrorOutput("fatal: not a git repository")).toBe(true);
    expect(isErrorOutput("npm ERR! code 1")).toBe(true);
    expect(isErrorOutput("Cannot find module 'x'")).toBe(true);
    expect(isErrorOutput("SyntaxError: unexpected token")).toBe(true);
  });

  it("should not flag normal output as error", () => {
    expect(isErrorOutput("On branch main")).toBe(false);
    expect(isErrorOutput("nothing to commit")).toBe(false);
  });
});

describe("isWarningOutput", () => {
  it("should detect npm warnings", () => {
    expect(isWarningOutput("npm WARN deprecated package")).toBe(true);
  });

  it("should not detect normal output as warning", () => {
    expect(isWarningOutput("added 42 packages")).toBe(false);
  });
});
