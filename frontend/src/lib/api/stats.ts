import api from '../api';

export interface NationalStats {
  total: number;
  byStatus: Record<string, number>;
  byProvince?: Record<string, number>;
  byCategory: Record<string, number>;
  paid?: number;
}

export interface ProvinceStats {
  total: number;
  byStatus: Record<string, number>;
  byZone?: Record<string, number>;
  byCategory: Record<string, number>;
  paid?: number;
}

export interface ZoneStats {
  total: number;
  byStatus: Record<string, number>;
  byAire?: Record<string, number>;
  byCategory: Record<string, number>;
  paid?: number;
}

export interface AireStats {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  paid?: number;
}

export const statsApi = {
  getNational: async (filters?: { campaignId?: string; formId?: string }): Promise<NationalStats> => {
    const params = new URLSearchParams();
    if (filters?.campaignId) params.append('campaignId', filters.campaignId);
    if (filters?.formId) params.append('formId', filters.formId);
    const queryString = params.toString();
    const url = `/stats/national${queryString ? `?${queryString}` : ''}`;
    const response = await api.get<NationalStats>(url);
    return response.data;
  },

  getProvince: async (id: string, filters?: { campaignId?: string; formId?: string }): Promise<ProvinceStats> => {
    const params = new URLSearchParams();
    if (filters?.campaignId) params.append('campaignId', filters.campaignId);
    if (filters?.formId) params.append('formId', filters.formId);
    const queryString = params.toString();
    const url = `/stats/province/${id}${queryString ? `?${queryString}` : ''}`;
    const response = await api.get<ProvinceStats>(url);
    return response.data;
  },

  getZone: async (id: string, filters?: { campaignId?: string; formId?: string }): Promise<any> => {
    const params = new URLSearchParams();
    if (filters?.campaignId) params.append('campaignId', filters.campaignId);
    if (filters?.formId) params.append('formId', filters.formId);
    const queryString = params.toString();
    const url = `/stats/zone/${id}${queryString ? `?${queryString}` : ''}`;
    const response = await api.get(url);
    return response.data;
  },

  getAire: async (id: string, filters?: { campaignId?: string; formId?: string }): Promise<any> => {
    const params = new URLSearchParams();
    if (filters?.campaignId) params.append('campaignId', filters.campaignId);
    if (filters?.formId) params.append('formId', filters.formId);
    const queryString = params.toString();
    const url = `/stats/aire/${id}${queryString ? `?${queryString}` : ''}`;
    const response = await api.get(url);
    return response.data;
  },

  getProvincesFromData: async (): Promise<{ id: string; name: string }[]> => {
    const response = await api.get<{ id: string; name: string }[]>('/stats/provinces-from-data');
    return response.data;
  },

  getZonesFromData: async (provinceId: string): Promise<{ id: string; name: string }[]> => {
    const response = await api.get<{ id: string; name: string }[]>(`/stats/zones-from-data/${provinceId}`);
    return response.data;
  },

  getAiresFromData: async (zoneId: string): Promise<{ id: string; name: string }[]> => {
    const response = await api.get<{ id: string; name: string }[]>(`/stats/aires-from-data/${zoneId}`);
    return response.data;
  },
};

