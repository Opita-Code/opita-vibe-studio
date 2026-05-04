import { describe, it, expect } from "vitest";
import {
  validateEmailFormat,
  isStudentEmail,
  getEmailDomain,
  validateStudentEmail,
} from "../../src/auth/verification";

describe("getEmailDomain", () => {
  it("should extract domain from email", () => {
    expect(getEmailDomain("user@unal.edu.co")).toBe("unal.edu.co");
  });

  it("should return empty string for email without @", () => {
    expect(getEmailDomain("notanemail")).toBe("");
  });
});

describe("validateEmailFormat", () => {
  it("should accept valid emails", () => {
    expect(validateEmailFormat("user@example.com")).toBe(true);
    expect(validateEmailFormat("nombre@unal.edu.co")).toBe(true);
  });

  it("should reject invalid emails", () => {
    expect(validateEmailFormat("")).toBe(false);
    expect(validateEmailFormat("notanemail")).toBe(false);
    expect(validateEmailFormat("@domain.com")).toBe(false);
    expect(validateEmailFormat("user@")).toBe(false);
    expect(validateEmailFormat("user@.com")).toBe(false);
  });
});

describe("isStudentEmail", () => {
  it("should identify .edu emails as student", () => {
    expect(isStudentEmail("student@harvard.edu")).toBe(true);
    expect(isStudentEmail("student@unal.edu.co")).toBe(true);
  });

  it("should return false for non-edu emails", () => {
    expect(isStudentEmail("user@gmail.com")).toBe(false);
    expect(isStudentEmail("user@opita.co")).toBe(false);
  });

  it("should be case insensitive", () => {
    expect(isStudentEmail("Student@UNAL.EDU.CO")).toBe(true);
  });
});

describe("validateStudentEmail", () => {
  it("should validate and identify .edu email as student", () => {
    const result = validateStudentEmail("student@unal.edu.co");
    expect(result.valid).toBe(true);
    expect(result.isStudent).toBe(true);
    expect(result.domain).toBe("unal.edu.co");
  });

  it("should validate non-edu email as valid but not student", () => {
    const result = validateStudentEmail("user@gmail.com");
    expect(result.valid).toBe(true);
    expect(result.isStudent).toBe(false);
    expect(result.reason).toContain(".edu");
  });

  it("should reject invalid email format", () => {
    const result = validateStudentEmail("invalid");
    expect(result.valid).toBe(false);
    expect(result.isStudent).toBe(false);
    expect(result.reason).toContain("Formato");
  });
});
