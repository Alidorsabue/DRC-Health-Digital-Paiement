/**
 * Configuration des colonnes à retourner pour l'API "Prestataires Approuvés"
 * Cette configuration est basée sur les colonnes affichées dans le tableau frontend
 * pour garantir la cohérence entre le frontend et le backend
 */

export const APPROVED_PRESTATAIRES_COLUMNS = [
  'id',
  'prestataireId',
  'provinceId',
  'zoneId',
  'aireId',
  'nom',
  'prenom',
  'postnom',
  'nom_complet',
  'gender',
  'telephone',
  'categorie',
  'kycStatus',
  'kyc_status',
  'validationStatus',
  'validation_status',
  'validationDate',
  'validation_date',
  'presenceDays',
  'presence_days',
  'approvalStatus',
  'approval_status',
  'approvalDate',
  'approval_date',
  'amountToPay',
  'amount_to_pay',
  'amountCurrency',
  'amount_currency',
  'paymentStatus',
  'payment_status',
  'paymentAmount',
  'payment_amount',
  'paymentDate',
  'payment_date',
] as const;

/**
 * Type pour les colonnes approuvées
 */
export type ApprovedPrestataireColumn = typeof APPROVED_PRESTATAIRES_COLUMNS[number];

/**
 * Fonction utilitaire pour filtrer un objet et ne garder que les colonnes approuvées
 */
export function filterApprovedPrestataireColumns(data: Record<string, any>): Record<string, any> {
  const filtered: Record<string, any> = {};
  
  for (const column of APPROVED_PRESTATAIRES_COLUMNS) {
    if (data[column] !== undefined) {
      filtered[column] = data[column];
    }
  }
  
  return filtered;
}

