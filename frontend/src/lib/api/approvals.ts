import api from '../api';

export interface Approval {
  id: string;
  prestataireId: string;
  decision: 'APPROVED' | 'REJECTED';
  commentaire?: string;
  mczId: string;
  createdAt: string;
  prestataire?: any;
}

export interface PrestataireForApproval {
  id: string;
  prestataireId: string;
  status: string;
  approvalStatus?: string;
  approvalDate?: string;
  validationDate?: string;
  validation_date?: string;
  paymentStatus?: string;
  paymentAmount?: number;
  paymentDate?: string;
  [key: string]: any;
}

export interface BatchApprovalDto {
  prestataireIds: string[];
  commentaire?: string;
}

export const approvalsApi = {
  /**
   * Récupère la liste des prestataires validés par IT pour approbation MCZ
   */
  getPrestatairesForApproval: async (
    formId: string,
    zoneId?: string,
    status?: string,
  ): Promise<PrestataireForApproval[]> => {
    const params = new URLSearchParams({ formId });
    if (zoneId) params.append('zoneId', zoneId);
    if (status) params.append('status', status);
    
    const response = await api.get<PrestataireForApproval[]>(
      `/approbations?${params.toString()}`,
    );
    return response.data;
  },

  /**
   * Approuver un prestataire
   */
  approve: async (
    prestataireId: string,
    commentaire?: string,
    formId?: string,
  ): Promise<Approval> => {
    const params = formId ? `?formId=${formId}` : '';
    const response = await api.post<Approval>(
      `/approbations/prestataires/${prestataireId}/approve${params}`,
      { decision: 'APPROVED', commentaire },
    );
    return response.data;
  },

  /**
   * Rejeter un prestataire
   */
  reject: async (
    prestataireId: string,
    commentaire: string,
    formId?: string,
  ): Promise<Approval> => {
    const params = formId ? `?formId=${formId}` : '';
    const response = await api.post<Approval>(
      `/approbations/prestataires/${prestataireId}/reject${params}`,
      { decision: 'REJECTED', commentaire },
    );
    return response.data;
  },

  /**
   * Approuver plusieurs prestataires en batch
   */
  approveBatch: async (
    prestataireIds: string[],
    commentaire?: string,
  ): Promise<Approval[]> => {
    const response = await api.post<Approval[]>(
      '/approbations/batch/approve',
      { prestataireIds, commentaire },
    );
    return response.data;
  },

  /**
   * Rejeter plusieurs prestataires en batch
   */
  rejectBatch: async (
    prestataireIds: string[],
    commentaire: string,
  ): Promise<Approval[]> => {
    const response = await api.post<Approval[]>(
      '/approbations/batch/reject',
      { prestataireIds, commentaire },
    );
    return response.data;
  },
};

