import api from '../api';
import { Form, FormVersion, CreateFormDto, CreateFormVersionDto } from '../../types';
import { getApiUrl } from '../../utils/api-url';

export const formsApi = {
  getAll: async (): Promise<Form[]> => {
    try {
      console.log('DEBUG FORMS API: Appel à /forms...');
      const response = await api.get<Form[]>('/forms');
      console.log('DEBUG FORMS API: Réponse reçue:', {
        status: response.status,
        statusText: response.statusText,
        dataLength: Array.isArray(response.data) ? response.data.length : 'not an array',
        data: response.data,
      });
      return response.data;
    } catch (error: any) {
      console.error('DEBUG FORMS API: Erreur lors de l\'appel à /forms:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: {
          url: error.config?.url,
          baseURL: error.config?.baseURL,
          method: error.config?.method,
          headers: error.config?.headers,
        },
      });
      throw error;
    }
  },

  getById: async (id: string): Promise<Form> => {
    const response = await api.get<Form>(`/forms/${id}`);
    return response.data;
  },

  create: async (data: CreateFormDto): Promise<Form> => {
    const response = await api.post<Form>('/forms', data);
    return response.data;
  },

  createVersion: async (
    formId: string,
    data: CreateFormVersionDto
  ): Promise<FormVersion> => {
    const response = await api.post<FormVersion>(
      `/forms/${formId}/versions`,
      data
    );
    return response.data;
  },

  publishVersion: async (
    formId: string,
    version: number
  ): Promise<FormVersion> => {
    const response = await api.patch<FormVersion>(
      `/forms/${formId}/versions/${version}/publish`
    );
    return response.data;
  },

  sendToMobile: async (
    formId: string,
    version: number
  ): Promise<FormVersion & { message: string }> => {
    const response = await api.patch<FormVersion & { message: string }>(
      `/forms/${formId}/versions/${version}/send`
    );
    return response.data;
  },

  retractFromMobile: async (
    formId: string,
    version: number
  ): Promise<FormVersion & { message: string }> => {
    const response = await api.patch<FormVersion & { message: string }>(
      `/forms/${formId}/versions/${version}/retract`
    );
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/forms/${id}`);
  },

  // API publiques (sans authentification)
  getPublic: async (id: string): Promise<any> => {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/forms/public/${id}`);
    if (!response.ok) {
      throw new Error('Formulaire non trouvé');
    }
    return response.json();
  },

  submitPublic: async (id: string, data: { campaignId?: string; data: Record<string, any> }): Promise<any> => {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/forms/public/${id}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      let errorMessage = 'Erreur lors de la soumission';
      try {
        const error = await response.json();
        errorMessage = error.message || errorMessage;
      } catch (e) {
        // Si la réponse n'est pas du JSON, utiliser le message par défaut
        errorMessage = `Erreur serveur (${response.status}): ${response.statusText}`;
      }
      
      // Créer une erreur avec plus de détails
      const error: any = new Error(errorMessage);
      error.status = response.status;
      error.response = response;
      throw error;
    }
    return response.json();
  },

  getPrestatairesCount: async (id: string): Promise<{ count: number }> => {
    const response = await api.get<{ count: number }>(`/forms/${id}/prestataires/count`);
    return response.data;
  },

  getPrestatairesData: async (id: string, page: number = 1, limit: number = 30, includeValidations: boolean = false): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
  }> => {
    const response = await api.get(`/forms/${id}/prestataires/data`, {
      params: { page, limit, includeValidations },
    });
    return response.data;
  },

  getStatistics: async (id: string): Promise<any> => {
    const response = await api.get(`/forms/${id}/statistics`);
    return response.data;
  },

  update: async (id: string, data: { name?: string; description?: string; linkedEnregistrementFormId?: string }): Promise<Form> => {
    const response = await api.patch<Form>(`/forms/${id}`, data);
    return response.data;
  },

  getEnregistrementFields: async (id: string): Promise<{
    linkedFormId: string | null;
    fields: Array<{ name: string; label: string; type: string }>;
  }> => {
    const response = await api.get(`/forms/${id}/enregistrement-fields`);
    return response.data;
  },

  importXlsForm: async (
    file: File,
    type: 'enregistrement' | 'validation' = 'enregistrement',
    title?: string
  ): Promise<{
    success: boolean;
    message: string;
    form: { id: string; name: string; description: string };
  }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    if (title && title.trim()) {
      formData.append('title', title.trim());
    }
    
    const response = await api.post('/forms/import-xlsform', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  updateXlsForm: async (
    formId: string,
    file: File
  ): Promise<{
    success: boolean;
    message: string;
    form: { id: string; name: string; description: string };
    version: { version: number; isPublished: boolean };
  }> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.patch(`/forms/${formId}/update-xlsform`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

