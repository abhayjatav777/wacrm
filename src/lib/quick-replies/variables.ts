export interface ContactVariableContext {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  [key: string]: string | null | undefined;
}

/**
 * Replace placeholders like {{name}}, {{phone}}, {{company}}, {{order_id}} in text
 * with corresponding values from the contact or variable dictionary.
 */
export function interpolateVariables(
  template: string,
  context: ContactVariableContext = {},
  fallback?: string
): string {
  if (!template) return '';

  return template.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (match, key) => {
    const normalizedKey = key.toLowerCase();

    // Standard contact mappings
    if (normalizedKey === 'name') {
      return context.name ?? (fallback !== undefined ? fallback : match);
    }
    if (normalizedKey === 'phone') {
      return context.phone ?? (fallback !== undefined ? fallback : match);
    }
    if (normalizedKey === 'email') {
      return context.email ?? (fallback !== undefined ? fallback : match);
    }
    if (normalizedKey === 'company') {
      return context.company ?? (fallback !== undefined ? fallback : match);
    }

    // Check direct context lookup
    if (context[key] !== undefined && context[key] !== null) {
      return String(context[key]);
    }
    if (context[normalizedKey] !== undefined && context[normalizedKey] !== null) {
      return String(context[normalizedKey]);
    }

    // Fallback if provided, else keep placeholder
    return fallback !== undefined ? fallback : match;
  });
}

/**
 * Extract all unique variable names from a template string (e.g. ['name', 'order_id']).
 */
export function extractVariableNames(template: string): string[] {
  if (!template) return [];
  const matches = template.matchAll(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g);
  const vars = new Set<string>();
  for (const match of matches) {
    if (match[1]) vars.add(match[1]);
  }
  return Array.from(vars);
}
