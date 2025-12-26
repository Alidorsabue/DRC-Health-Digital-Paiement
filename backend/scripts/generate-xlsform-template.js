/**
 * Script pour générer un fichier XLSForm template à partir des fichiers CSV
 * 
 * Usage: node scripts/generate-xlsform-template.js
 * 
 * Ce script crée un fichier Excel (.xlsx) avec les 3 feuilles nécessaires :
 * - survey
 * - choices
 * - settings
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Chemins des fichiers CSV
const surveyCsvPath = path.join(__dirname, '../templates/xlsform_template_survey.csv');
const choicesCsvPath = path.join(__dirname, '../templates/xlsform_template_choices.csv');
const settingsCsvPath = path.join(__dirname, '../templates/xlsform_template_settings.csv');
const outputPath = path.join(__dirname, '../templates/xlsform_template.xlsx');

// Fonction pour lire un fichier CSV et le convertir en feuille Excel
function csvToSheet(csvPath) {
  if (!fs.existsSync(csvPath)) {
    console.warn(`Fichier CSV non trouvé: ${csvPath}`);
    return null;
  }
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const workbook = XLSX.read(csvContent, { type: 'string' });
  return workbook.Sheets[workbook.SheetNames[0]];
}

// Créer un nouveau classeur Excel
const workbook = XLSX.utils.book_new();

// Ajouter la feuille "survey"
const surveySheet = csvToSheet(surveyCsvPath);
if (surveySheet) {
  XLSX.utils.book_append_sheet(workbook, surveySheet, 'survey');
  console.log('✓ Feuille "survey" ajoutée');
} else {
  console.error('✗ Impossible de charger la feuille "survey"');
}

// Ajouter la feuille "choices"
const choicesSheet = csvToSheet(choicesCsvPath);
if (choicesSheet) {
  XLSX.utils.book_append_sheet(workbook, choicesSheet, 'choices');
  console.log('✓ Feuille "choices" ajoutée');
} else {
  console.error('✗ Impossible de charger la feuille "choices"');
}

// Ajouter la feuille "settings"
const settingsSheet = csvToSheet(settingsCsvPath);
if (settingsSheet) {
  XLSX.utils.book_append_sheet(workbook, settingsSheet, 'settings');
  console.log('✓ Feuille "settings" ajoutée');
} else {
  console.error('✗ Impossible de charger la feuille "settings"');
}

// Écrire le fichier Excel
try {
  XLSX.writeFile(workbook, outputPath);
  console.log(`\n✅ Fichier XLSForm template créé avec succès: ${outputPath}`);
  console.log('\nVous pouvez maintenant :');
  console.log('1. Ouvrir ce fichier dans Excel');
  console.log('2. Personnaliser les données selon vos besoins');
  console.log('3. L\'importer dans le système via l\'interface web');
} catch (error) {
  console.error('✗ Erreur lors de la création du fichier Excel:', error.message);
  process.exit(1);
}






