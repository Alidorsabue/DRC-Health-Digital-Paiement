import api from '../api';

export const sharedApi = {
  /**
   * Créer un lien public partageable pour des données JSON
   */
  async createSharedData(data: any, expiresInHours?: number): Promise<{
    success: boolean;
    token: string;
    publicUrl: string;
    expiresAt: string;
    expiresInHours: number;
  }> {
    const response = await api.post('/shared/data', {
      data,
      expiresInHours,
    });
    return response.data;
  },
};

