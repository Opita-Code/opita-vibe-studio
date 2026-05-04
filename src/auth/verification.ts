// ─── Student Email Domains ──────────────────────────────────────

/** Dominios de email reconocidos como institucionales/educativos. */
const STUDENT_DOMAINS = [
  ".edu",
  ".edu.ar",
  ".edu.bo",
  ".edu.cl",
  ".edu.co",
  ".edu.ec",
  ".edu.mx",
  ".edu.pe",
  ".edu.uy",
  ".edu.ve",
];

// ─── Email Validation ───────────────────────────────────────────

/**
 * Extrae el dominio de un email (todo después del @).
 */
export function getEmailDomain(email: string): string {
  const atIndex = email.lastIndexOf("@");
  if (atIndex === -1) return "";
  return email.slice(atIndex + 1).toLowerCase();
}

/**
 * Verifica si un email tiene un dominio educativo reconocido.
 */
export function isStudentEmail(email: string): boolean {
  const domain = getEmailDomain(email);
  if (!domain) return false;
  return STUDENT_DOMAINS.some((eduDomain) => domain.endsWith(eduDomain));
}

/**
 * Valida el formato básico de un email.
 * No hace peticiones de red — solo validación sintáctica.
 */
export function validateEmailFormat(email: string): boolean {
  if (!email || email.length > 254) return false;

  // Regex simple pero efectiva para formato email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return false;

  const [localPart, domain] = email.split("@");
  if (!localPart || localPart.length > 64) return false;
  if (!domain || domain.length > 253) return false;

  // No permitir dominios con guión al inicio o final
  const domainParts = domain.split(".");
  for (const part of domainParts) {
    if (!part || part.startsWith("-") || part.endsWith("-")) return false;
  }

  return true;
}

/**
 * Valida que un email sea estudiante: formato válido + dominio .edu.
 */
export function validateStudentEmail(email: string): {
  valid: boolean;
  isStudent: boolean;
  domain: string;
  reason?: string;
} {
  const domain = getEmailDomain(email);

  if (!validateEmailFormat(email)) {
    return {
      valid: false,
      isStudent: false,
      domain,
      reason: "Formato de email inválido",
    };
  }

  const student = isStudentEmail(email);

  return {
    valid: true,
    isStudent: student,
    domain,
    reason: student ? undefined : "El dominio no es educativo (.edu requerido)",
  };
}
