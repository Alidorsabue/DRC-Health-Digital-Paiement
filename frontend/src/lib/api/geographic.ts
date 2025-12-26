import api from '../api';

export interface Province {
  id: string;
  name: string;
}

export interface Zone {
  id: string;
  name: string;
  provinceId: string;
}

export interface Aire {
  id: string;
  name: string;
  zoneId: string;
}

export const geographicApi = {
  getProvinces: async (): Promise<Province[]> => {
    const response = await api.get<Province[]>('/geographic/provinces');
    return response.data;
  },

  getZones: async (provinceId: string): Promise<Zone[]> => {
    const response = await api.get<Zone[]>(`/geographic/zones?provinceId=${provinceId}`);
    return response.data;
  },

  getAires: async (zoneId: string): Promise<Aire[]> => {
    const response = await api.get<Aire[]>(`/geographic/aires?zoneId=${zoneId}`);
    return response.data;
  },
};

