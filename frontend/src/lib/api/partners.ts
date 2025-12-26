import api from '../api';

export interface PrestataireForPartner {
  id: string;
  prestataireId: string;
  status: string;
  approvalStatus?: string;
  approvalDate?: string;
  validationDate?: string;
  paymentStatus?: string;
  paymentAmount?: number;
  paymentDate?: string;
  presenceDays?: number;
  amountToPay?: number;
  amountCurrency?: string; // Devise du montant à payer (USD, CDF, EURO)
  categorie?: string;
  provinceId?: string;
  zoneId?: string;
  aireId?: string;
  nom?: string;
  prenom?: string;
  postnom?: string;
  nom_complet?: string;
  telephone?: string;
  [key: string]: any;
}

export interface PaymentReportRow {
  prestataireId: string;
  status: 'PENDING' | 'SENT' | 'PAID' | 'FAILED';
  paymentDate?: string;
  transactionId?: string;
  paymentReference?: string;
  paymentAmount?: number;
}

export interface ImportPaymentReportDto {
  payments: PaymentReportRow[];
}

export interface ImportPrestataireDto {
  nom?: string;
  prenom?: string;
  postnom?: string;
  telephone: string;
  email?: string;
  categorie: string;
  zoneId?: string;
  aireId?: string;
  campaignId?: string;
  externalId?: string;
  customData?: any;
}

export interface ImportPrestatairesDto {
  prestataires: ImportPrestataireDto[];
  formId?: string;
  campaignId?: string;
}

export interface KycReportRow {
  prestataireId: string;
  status: 'CORRECT' | 'INCORRECT' | 'SANS_COMPTE';
  telephone?: string;
}

export interface ImportKycReportDto {
  kycResults: KycReportRow[];
}

export interface UpdatePaymentAmountsDto {
  amounts: Array<{
    prestataireId: string;
    amount: number;
    currency?: string; // Devise (USD, CDF, EURO)
  }>;
}

export const partnersApi = {
  /**
   * Récupère la liste des prestataires enregistrés (statut ENREGISTRE) pour la vérification KYC
   */
  getRegisteredPrestataires: async (
    campaignId?: string,
    formId?: string,
    category?: string,
    provinceId?: string,
    zoneId?: string,
    aireId?: string,
  ): Promise<PrestataireForPartner[]> => {
    const params = new URLSearchParams();
    if (campaignId) params.append('campaignId', campaignId);
    if (formId) params.append('formId', formId);
    if (category) params.append('category', category);
    if (provinceId) params.append('provinceId', provinceId);
    if (zoneId) params.append('zoneId', zoneId);
    if (aireId) params.append('aireId', aireId);
    
    const response = await api.get<PrestataireForPartner[]>(
      `/partner/prestataires/enregistres?${params.toString()}`,
    );
    return response.data;
  },

  /**
   * Récupère la liste des prestataires approuvés par MCZ pour le partenaire
   */
  getApprovedPrestataires: async (
    campaignId?: string,
    formId?: string,
    category?: string,
    provinceId?: string,
    zoneId?: string,
    aireId?: string,
  ): Promise<PrestataireForPartner[]> => {
    const params = new URLSearchParams();
    if (campaignId) params.append('campaignId', campaignId);
    if (formId) params.append('formId', formId);
    if (category) params.append('category', category);
    if (provinceId) params.append('provinceId', provinceId);
    if (zoneId) params.append('zoneId', zoneId);
    if (aireId) params.append('aireId', aireId);
    
    const response = await api.get<PrestataireForPartner[]>(
      `/partner/prestataires?${params.toString()}`,
    );
    return response.data;
  },

  /**
   * Importe un rapport de paiement pour mettre à jour les statuts de paiement
   */
  importPaymentReport: async (
    data: ImportPaymentReportDto,
    formId?: string,
  ): Promise<{ success: number; errors: Array<{ prestataireId: string; error: string }> }> => {
    const params = new URLSearchParams();
    if (formId) params.append('formId', formId);
    
    const response = await api.post<{ success: number; errors: Array<{ prestataireId: string; error: string }> }>(
      `/partner/import/payment-report?${params.toString()}`,
      data,
    );
    return response.data;
  },

  /**
   * Importe des prestataires depuis le système partenaire
   */
  importPrestataires: async (
    data: ImportPrestatairesDto,
  ): Promise<{ success: number; errors: Array<{ prestataire: any; error: string }> }> => {
    const response = await api.post<{ success: number; errors: Array<{ prestataire: any; error: string }> }>(
      '/partner/import/prestataires',
      data,
    );
    return response.data;
  },

  /**
   * Importe un rapport de résultats KYC pour mettre à jour les statuts KYC des prestataires
   */
  importKycReport: async (
    data: ImportKycReportDto,
    formId?: string,
  ): Promise<{ success: number; errors: Array<{ prestataireId: string; error: string }> }> => {
    const params = new URLSearchParams();
    if (formId) params.append('formId', formId);
    
    const response = await api.post<{ success: number; errors: Array<{ prestataireId: string; error: string }> }>(
      `/partner/import/kyc-report?${params.toString()}`,
      data,
    );
    return response.data;
  },

  /**
   * Met à jour les montants à payer pour les prestataires
   */
  updatePaymentAmounts: async (
    dto: UpdatePaymentAmountsDto,
    formId?: string,
  ): Promise<{ success: number; errors: string[] }> => {
    const params = new URLSearchParams();
    if (formId) params.append('formId', formId);
    
    const response = await api.post<{ success: number; errors: string[] }>(
      `/partner/payment-amounts?${params.toString()}`,
      dto,
    );
    return response.data;
  },
};

