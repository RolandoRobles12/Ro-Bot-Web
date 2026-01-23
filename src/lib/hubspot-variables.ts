import { HubSpotVariable } from '@/types';

/**
 * Common HubSpot properties that can be used as variables in templates
 */
export const HUBSPOT_CONTACT_VARIABLES: HubSpotVariable[] = [
  { name: 'contact.firstname', label: 'First Name', type: 'contact', path: 'properties.firstname', example: 'John' },
  { name: 'contact.lastname', label: 'Last Name', type: 'contact', path: 'properties.lastname', example: 'Doe' },
  { name: 'contact.email', label: 'Email', type: 'contact', path: 'properties.email', example: 'john@example.com' },
  { name: 'contact.phone', label: 'Phone', type: 'contact', path: 'properties.phone', example: '+1234567890' },
  { name: 'contact.company', label: 'Company Name', type: 'contact', path: 'properties.company', example: 'Acme Inc' },
  { name: 'contact.jobtitle', label: 'Job Title', type: 'contact', path: 'properties.jobtitle', example: 'CEO' },
  { name: 'contact.website', label: 'Website', type: 'contact', path: 'properties.website', example: 'www.example.com' },
  { name: 'contact.city', label: 'City', type: 'contact', path: 'properties.city', example: 'New York' },
  { name: 'contact.state', label: 'State', type: 'contact', path: 'properties.state', example: 'NY' },
  { name: 'contact.country', label: 'Country', type: 'contact', path: 'properties.country', example: 'USA' },
];

export const HUBSPOT_COMPANY_VARIABLES: HubSpotVariable[] = [
  { name: 'company.name', label: 'Company Name', type: 'company', path: 'properties.name', example: 'Acme Inc' },
  { name: 'company.domain', label: 'Domain', type: 'company', path: 'properties.domain', example: 'acme.com' },
  { name: 'company.industry', label: 'Industry', type: 'company', path: 'properties.industry', example: 'Technology' },
  { name: 'company.employees', label: 'Number of Employees', type: 'company', path: 'properties.numberofemployees', example: '50' },
  { name: 'company.revenue', label: 'Annual Revenue', type: 'company', path: 'properties.annualrevenue', example: '1000000' },
  { name: 'company.phone', label: 'Phone', type: 'company', path: 'properties.phone', example: '+1234567890' },
  { name: 'company.city', label: 'City', type: 'company', path: 'properties.city', example: 'San Francisco' },
  { name: 'company.state', label: 'State', type: 'company', path: 'properties.state', example: 'CA' },
];

export const HUBSPOT_DEAL_VARIABLES: HubSpotVariable[] = [
  { name: 'deal.name', label: 'Deal Name', type: 'deal', path: 'properties.dealname', example: 'Q1 2024 Contract' },
  { name: 'deal.amount', label: 'Amount', type: 'deal', path: 'properties.amount', example: '50000' },
  { name: 'deal.stage', label: 'Deal Stage', type: 'deal', path: 'properties.dealstage', example: 'negotiation' },
  { name: 'deal.closedate', label: 'Close Date', type: 'deal', path: 'properties.closedate', example: '2024-03-31' },
  { name: 'deal.pipeline', label: 'Pipeline', type: 'deal', path: 'properties.pipeline', example: 'default' },
  { name: 'deal.probability', label: 'Probability', type: 'deal', path: 'properties.probability', example: '75' },
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
