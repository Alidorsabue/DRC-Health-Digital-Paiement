import api from '../api';
import { PrestataireStatus } from '../../types';

export interface Prestataire {
  id: string;
  prestataireId: string;
  status: PrestataireStatus;
  paymentStatus?: string;
  paymentAmount?: number;
  paymentDate?: string;
  transactionId?: string;
  campaignId?: string;
  provinceId?: string;
  zoneId?: string;
  aireId?: string;
  [key: string]: any;
}

export const prestatairesApi = {
  /**
   * Récupère la liste des prestataires avec filtres
   */
  getAll: async (filters?: {
    campaignId?: string;
    provinceId?: string;
    zoneId?: string;
    aireId?: string;
    status?: PrestataireStatus;
  }): Promise<Prestataire[]> => {
    const params = new URLSearchParams();
    if (filters?.campaignId) params.append('campaignId', filters.campaignId);
    if (filters?.provinceId) params.append('provinceId', filters.provinceId);
    if (filters?.zoneId) params.append('zoneId', filters.zoneId);
    if (filters?.aireId) params.append('aireId', filters.aireId);
    if (filters?.status) params.append('status', filters.status);

    const response = await api.get<Prestataire[]>(
      `/prestataires?${params.toString()}`,
    );
    return response.data;
  },

  /**
   * Récupère un prestataire par ID
   */
  getById: async (id: string): Promise<Prestataire> => {
    const response = await api.get<Prestataire>(`/prestataires/${id}`);
    return response.data;
  },

  /**
   * Met à jour un prestataire
   */
  update: async (id: string, data: Partial<Prestataire>, formId: string): Promise<Prestataire> => {
    const response = await api.patch<Prestataire>(`/prestataires/${id}`, data, {
      params: { formId },
    });
    return response.data;
  },

  /**
   * Supprime un prestataire
   */
  delete: async (id: string, formId: string): Promise<void> => {
    await api.delete(`/prestataires/${id}`, {
      params: { formId },
    });
  },
};

