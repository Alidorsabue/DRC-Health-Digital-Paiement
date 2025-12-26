import { Repository } from 'typeorm';
import { DataSource } from 'typeorm';

/**
 * Génère un ID unique au format ID-YYMM-HHmm-XXX
 * où YYMM = année (2 chiffres) + mois
 * HHmm = heure + minute
 * XXX = nombre aléatoire unique (100-999)
 */
export async function generatePrestataireId<T>(
  repository: Repository<T>,
  idColumn: string = 'id',
): Promise<string> {
  const now = new Date();
  
  // Format: YYMM (année sur 2 chiffres, mois) - SANS le jour
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const datePart = `${year}${month}`;
  
  // Format: HHmm (heure, minute)
  const hour = now.getHours().toString().padStart(2, '0');
  const minute = now.getMinutes().toString().padStart(2, '0');
  const timePart = `${hour}${minute}`;
  
  // Générer un nombre aléatoire entre 100 et 999 (3 chiffres)
  let randomPart: number;
  let fullId: string;
  let attempts = 0;
  const maxAttempts = 100; // Limite de tentatives pour éviter une boucle infinie
  
  do {
    randomPart = Math.floor(Math.random() * 900) + 100; // Entre 100 et 999
    fullId = `ID-${datePart}-${timePart}-${randomPart}`;
    
    // Vérifier l'unicité dans la base de données
    const existing = await repository
      .createQueryBuilder()
      .where(`${idColumn} = :id`, { id: fullId })
      .getOne();
    
    if (!existing) {
      return fullId;
    }
    
    attempts++;
    
    // Si on a trop de collisions, utiliser les millisecondes
    if (attempts > 10) {
      const milliseconds = now.getMilliseconds();
      randomPart = 100 + (milliseconds % 900); // Entre 100 et 999 basé sur les millisecondes
      fullId = `ID-${datePart}-${timePart}-${randomPart.toString().padStart(3, '0')}`;
      const existing2 = await repository
        .createQueryBuilder()
        .where(`${idColumn} = :id`, { id: fullId })
        .getOne();
      if (!existing2) {
        return fullId;
      }
    }
  } while (attempts < maxAttempts);
  
  // En cas d'échec après plusieurs tentatives, utiliser un timestamp en millisecondes
  const timestamp = Date.now().toString().slice(-3);
  return `ID-${datePart}-${timePart}-${timestamp.padStart(3, '0')}`;
}

/**
 * Génère un ID de soumission unique au format ID-YYMM-HHmm-XXX
 * Utilise la même logique que generatePrestataireId mais vérifie dans les tables de formulaires
 */
export async function generateSubmissionId(
  dataSource: DataSource,
  formId?: string,
  createdAt?: Date,
): Promise<string> {
  const now = createdAt || new Date();
  
  // Format: YYMM (année sur 2 chiffres, mois) - SANS le jour
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const datePart = `${year}${month}`;
  
  // Format: HHmm (heure, minute)
  const hour = now.getHours().toString().padStart(2, '0');
  const minute = now.getMinutes().toString().padStart(2, '0');
  const timePart = `${hour}${minute}`;
  
  // Générer un nombre aléatoire entre 100 et 999 (3 chiffres)
  let randomPart: number;
  let fullId: string;
  let attempts = 0;
  const maxAttempts = 100;
  
  do {
    randomPart = Math.floor(Math.random() * 900) + 100; // Entre 100 et 999
    fullId = `ID-${datePart}-${timePart}-${randomPart}`;
    
    // Vérifier l'unicité dans les tables de formulaires
    let existing = false;
    
    if (formId) {
      // Vérifier dans la table spécifique du formulaire
      const tableName = `form_${formId.replace(/-/g, '_')}`;
      try {
        const result = await dataSource.query(
          `SELECT submission_id FROM "${tableName}" WHERE submission_id = $1 LIMIT 1`,
          [fullId],
        );
        existing = result.length > 0;
      } catch (error) {
        // Table n'existe pas encore, on peut utiliser cet ID
        existing = false;
      }
    } else {
      // Vérifier dans toutes les tables de formulaires (plus coûteux)
      // Pour l'instant, on fait confiance au hasard pour l'unicité
      // En production, il faudrait une table centrale des submission IDs
      existing = false;
    }
    
    if (!existing) {
      return fullId;
    }
    
    attempts++;
    
    // Si on a trop de collisions, utiliser les millisecondes
    if (attempts > 10) {
      const milliseconds = now.getMilliseconds();
      randomPart = 100 + (milliseconds % 900);
      fullId = `ID-${datePart}-${timePart}-${randomPart.toString().padStart(3, '0')}`;
      
      if (formId) {
        const tableName = `form_${formId.replace(/-/g, '_')}`;
        try {
          const result = await dataSource.query(
            `SELECT submission_id FROM "${tableName}" WHERE submission_id = $1 LIMIT 1`,
            [fullId],
          );
          if (result.length === 0) {
            return fullId;
          }
        } catch (error) {
          return fullId;
        }
      } else {
        return fullId;
      }
    }
  } while (attempts < maxAttempts);
  
  // En cas d'échec après plusieurs tentatives, utiliser un timestamp en millisecondes
  const timestamp = Date.now().toString().slice(-3);
  return `ID-${datePart}-${timePart}-${timestamp.padStart(3, '0')}`;
}
