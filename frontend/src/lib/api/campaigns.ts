import api from '../api';
import { Campaign, CreateCampaignDto } from '../../types';

export const campaignsApi = {
  getAll: async (): Promise<Campaign[]> => {
    const response = await api.get<Campaign[]>('/campaigns');
    return response.data;
  },

  getById: async (id: string): Promise<Campaign> => {
    const response = await api.get<Campaign>(`/campaigns/${id}`);
    return response.data;
  },

  create: async (data: CreateCampaignDto): Promise<Campaign> => {
    const response = await api.post<Campaign>('/campaigns', data);
    return response.data;
  },

  update: async (
    id: string,
    data: Partial<CreateCampaignDto>
  ): Promise<Campaign> => {
    const response = await api.patch<Campaign>(`/campaigns/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/campaigns/${id}`);
  },
};

