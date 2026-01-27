import { HubSpotVariable } from '@/types';

/**
 * Common HubSpot properties that can be used as variables in templates
 */
export const HUBSPOT_CONTACT_VARIABLES: HubSpotVariable[] = [
  { name: 'contact.firstname', label: 'Nombre', type: 'contact', path: 'properties.firstname', example: 'Juan' },
  { name: 'contact.lastname', label: 'Apellido', type: 'contact', path: 'properties.lastname', example: 'Pérez' },
  { name: 'contact.email', label: 'Correo', type: 'contact', path: 'properties.email', example: 'juan@ejemplo.com' },
  { name: 'contact.phone', label: 'Teléfono', type: 'contact', path: 'properties.phone', example: '+521234567890' },
  { name: 'contact.company', label: 'Nombre de Empresa', type: 'contact', path: 'properties.company', example: 'Empresa SA' },
  { name: 'contact.jobtitle', label: 'Puesto', type: 'contact', path: 'properties.jobtitle', example: 'Director' },
  { name: 'contact.website', label: 'Sitio Web', type: 'contact', path: 'properties.website', example: 'www.ejemplo.com' },
  { name: 'contact.city', label: 'Ciudad', type: 'contact', path: 'properties.city', example: 'Ciudad de México' },
  { name: 'contact.state', label: 'Estado', type: 'contact', path: 'properties.state', example: 'CDMX' },
  { name: 'contact.country', label: 'País', type: 'contact', path: 'properties.country', example: 'México' },
];

export const HUBSPOT_COMPANY_VARIABLES: HubSpotVariable[] = [
  { name: 'company.name', label: 'Nombre de Empresa', type: 'company', path: 'properties.name', example: 'Empresa SA' },
  { name: 'company.domain', label: 'Dominio', type: 'company', path: 'properties.domain', example: 'empresa.com' },
  { name: 'company.industry', label: 'Industria', type: 'company', path: 'properties.industry', example: 'Tecnología' },
  { name: 'company.employees', label: 'Número de Empleados', type: 'company', path: 'properties.numberofemployees', example: '50' },
  { name: 'company.revenue', label: 'Ingresos Anuales', type: 'company', path: 'properties.annualrevenue', example: '1000000' },
  { name: 'company.phone', label: 'Teléfono', type: 'company', path: 'properties.phone', example: '+521234567890' },
  { name: 'company.city', label: 'Ciudad', type: 'company', path: 'properties.city', example: 'Monterrey' },
  { name: 'company.state', label: 'Estado', type: 'company', path: 'properties.state', example: 'NL' },
];

export const HUBSPOT_DEAL_VARIABLES: HubSpotVariable[] = [
  { name: 'deal.name', label: 'Nombre del Negocio', type: 'deal', path: 'properties.dealname', example: 'Contrato Q1 2024' },
  { name: 'deal.amount', label: 'Monto', type: 'deal', path: 'properties.amount', example: '50000' },
  { name: 'deal.stage', label: 'Etapa del Negocio', type: 'deal', path: 'properties.dealstage', example: 'negociación' },
  { name: 'deal.closedate', label: 'Fecha de Cierre', type: 'deal', path: 'properties.closedate', example: '2024-03-31' },
  { name: 'deal.pipeline', label: 'Pipeline', type: 'deal', path: 'properties.pipeline', example: 'default' },
  { name: 'deal.probability', label: 'Probabilidad', type: 'deal', path: 'properties.probability', example: '75' },
];

export const ALL_HUBSPOT_VARIABLES: HubSpotVariable[] = [
  ...HUBSPOT_CONTACT_VARIABLES,
  ...HUBSPOT_COMPANY_VARIABLES,
  ...HUBSPOT_DEAL_VARIABLES,
];

/**
 * Extract variables from a template string
 * Supports both {{variable}} and {variable} formats
 */
export function extractVariables(template: string): string[] {
  const regex = /\{\{?(\w+(?:\.\w+)*)\}?\}/g;
  const matches = template.matchAll(regex);
  const variables = new Set<string>();

  for (const match of matches) {
    variables.add(match[1]);
  }

  return Array.from(variables);
}

/**
 * Replace variables in a template with actual values
 */
export function replaceVariables(
  template: string,
  values: Record<string, any>
): string {
  let result = template;

  // Replace {{variable}} and {variable} patterns
  const regex = /\{\{?(\w+(?:\.\w+)*)\}?\}/g;

  result = result.replace(regex, (match, variable) => {
    // Support nested properties (e.g., contact.firstname)
    const value = variable.split('.').reduce((obj: any, key: string) => {
      return obj?.[key];
    }, values);

    return value !== undefined ? String(value) : match;
  });

  return result;
}

/**
 * Validate that all required variables are present in the values object
 */
export function validateVariables(
  template: string,
  values: Record<string, any>
): { valid: boolean; missing: string[] } {
  const variables = extractVariables(template);
  const missing: string[] = [];

  for (const variable of variables) {
    const value = variable.split('.').reduce((obj: any, key: string) => {
      return obj?.[key];
    }, values);

    if (value === undefined || value === null) {
      missing.push(variable);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Get variable suggestions based on input
 */
export function getVariableSuggestions(
  input: string,
  allVariables: HubSpotVariable[] = ALL_HUBSPOT_VARIABLES
): HubSpotVariable[] {
  const search = input.toLowerCase();
  return allVariables.filter(
    (v) =>
      v.name.toLowerCase().includes(search) ||
      v.label.toLowerCase().includes(search)
  );
}
