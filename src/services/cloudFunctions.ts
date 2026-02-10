import { httpsCallable } from 'firebase/functions';
import { functions } from '@/config/firebase';

/**
 * Generate an AI message using OpenAI via Cloud Function.
 */
export const generateAIMessage = httpsCallable<
  {
    prompt: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    workspaceId: string;
  },
  { success: boolean; text: string }
>(functions, 'generateAIMessage');

/**
 * Manually trigger a campaign execution (for testing).
 */
export const triggerCampaign = httpsCallable<
  { campaignId: string },
  { success: boolean; message: string }
>(functions, 'triggerCampaign');

/**
 * Read data from a Google Sheet.
 */
export const readGoogleSheet = httpsCallable<
  {
    sheetId: string;
    range?: string;
    workspaceId: string;
  },
  { success: boolean; data: string[][]; rowCount: number; headers: string[] }
>(functions, 'readGoogleSheet');

/**
 * Calculate sales metrics for a user from HubSpot.
 */
export const calculateSalesMetrics = httpsCallable<
  {
    salesUserId: string;
    startDate: string;
    endDate: string;
  },
  {
    success: boolean;
    metrics: {
      solicitudes: number;
      ventasAvanzadas: number;
      ventasReales: number;
      progresoSolicitudes: number;
      progresoVentas: number;
      progresoEsperado: number;
      categoria: string;
    };
  }
>(functions, 'calculateSalesMetrics');
