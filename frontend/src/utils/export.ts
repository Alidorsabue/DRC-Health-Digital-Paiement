/**
 * Utilitaire d'export pour différents formats (CSV, Excel (XLSX), PDF, Image)
 */

export interface ExportColumn {
  key: string;
  label: string;
}

export interface ExportRow {
  [key: string]: any;
}

/**
 * Exporte les données en CSV
 */
export function exportToCSV(
  data: ExportRow[],
  columns: ExportColumn[],
  filename: string = 'export.csv'
): void {
  // En-têtes
  const headers = columns.map((col) => col.label).join(',');
  
  // Données
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const value = row[col.key] || '';
        // Échapper les valeurs contenant des virgules ou des guillemets
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      })
      .join(',')
  );
  
  const csvContent = [headers, ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

/**
 * Exporte les données en Excel (format XLSX - nécessite la bibliothèque xlsx)
 * XLSX est le format Excel moderne recommandé, compatible avec toutes les versions récentes d'Excel
 */
async function exportToExcel(
  data: ExportRow[],
  columns: ExportColumn[],
  filename: string = 'export.xlsx'
): Promise<void> {
  try {
    // Lazy load xlsx - xlsx peut s'importer de différentes façons selon la version
    const xlsxModule = await import('xlsx');
    
    // xlsx peut exporter soit comme default, soit comme namespace
    const XLSX = (xlsxModule as any).default || xlsxModule;
    
    if (!XLSX || !XLSX.utils || !XLSX.writeFile) {
      throw new Error('La bibliothèque xlsx n\'a pas pu être chargée correctement. Veuillez réinstaller les dépendances avec: npm install xlsx');
    }
    
    // Préparer les données
    const worksheetData = [
      columns.map((col) => col.label), // En-têtes
      ...data.map((row) => columns.map((col) => {
        const value = row[col.key];
        // Convertir les objets complexes en string
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          return JSON.stringify(value);
        }
        return value || '';
      })),
    ];
    
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    
    // Générer le fichier
    XLSX.writeFile(workbook, filename);
  } catch (error: any) {
    console.error('Erreur lors de l\'export Excel:', error);
    const errorMessage = error?.message || String(error);
    alert(`Erreur lors de l'export Excel: ${errorMessage}\n\nVeuillez installer la bibliothèque xlsx avec: npm install xlsx`);
    throw error; // Ne pas faire de fallback silencieux
  }
}

/**
 * Exporte les données en PDF (nécessite jsPDF et jspdf-autotable)
 */
export async function exportToPDF(
  data: ExportRow[],
  columns: ExportColumn[],
  filename: string = 'export.pdf',
  title: string = 'Export de données'
): Promise<void> {
  try {
    // Lazy load jsPDF et jspdf-autotable
    const jsPDFModule = await import('jspdf');
    await import('jspdf-autotable');
    
    // jsPDF peut s'exporter différemment selon la version
    const jsPDFClass = (jsPDFModule as any).default?.jsPDF || (jsPDFModule as any).jsPDF || (jsPDFModule as any).default;
    
    if (!jsPDFClass) {
      throw new Error('La bibliothèque jsPDF n\'a pas pu être chargée. Veuillez réinstaller les dépendances avec: npm install jspdf jspdf-autotable');
    }
    
    const doc = new jsPDFClass();
    
    // Titre
    doc.setFontSize(16);
    doc.text(title, 14, 22);
    
    // Préparer les données pour autotable
    const tableData = data.map((row) =>
      columns.map((col) => String(row[col.key] || ''))
    );
    
    // Ajouter le tableau
    (doc as any).autoTable({
      head: [columns.map((col) => col.label)],
      body: tableData,
      startY: 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [71, 85, 105] },
    });
    
    // Sauvegarder
    doc.save(filename);
  } catch (error: any) {
    console.error('Erreur lors de l\'export PDF:', error);
    const errorMessage = error?.message || String(error);
    alert(`Erreur lors de l'export PDF: ${errorMessage}\n\nVeuillez installer les bibliothèques avec: npm install jspdf jspdf-autotable`);
    throw error;
  }
}

/**
 * Exporte un tableau HTML en image (PNG)
 */
export async function exportTableToImage(
  tableElement: HTMLElement,
  filename: string = 'export.png'
): Promise<void> {
  try {
    // Lazy load html2canvas
    const html2canvasModule = await import('html2canvas');
    const html2canvas = (html2canvasModule as any).default || html2canvasModule;
    
    if (!html2canvas || typeof html2canvas !== 'function') {
      throw new Error('La bibliothèque html2canvas n\'a pas pu être chargée. Veuillez réinstaller les dépendances avec: npm install html2canvas');
    }
    
    const canvas = await html2canvas(tableElement, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
    });
    
    canvas.toBlob((blob) => {
      if (blob) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
      }
    }, 'image/png');
  } catch (error: any) {
    console.error('Erreur lors de l\'export image:', error);
    const errorMessage = error?.message || String(error);
    alert(`Erreur lors de l'export image: ${errorMessage}\n\nVeuillez installer la bibliothèque avec: npm install html2canvas`);
    throw error;
  }
}

/**
 * Exporte les données dans différents formats
 */
export async function exportData(
  format: 'csv' | 'excel' | 'pdf' | 'image',
  data: ExportRow[],
  columns: ExportColumn[],
  filename: string,
  tableElement?: HTMLElement,
  title?: string
): Promise<void> {
  const timestamp = new Date().toISOString().split('T')[0];
  const baseFilename = filename || `export-${timestamp}`;
  
  try {
    switch (format) {
      case 'csv':
        exportToCSV(data, columns, `${baseFilename}.csv`);
        break;
      case 'excel':
        // Utiliser XLSX (format Excel moderne et recommandé)
        await exportToExcel(data, columns, `${baseFilename}.xlsx`);
        break;
      case 'pdf':
        await exportToPDF(data, columns, `${baseFilename}.pdf`, title);
        break;
      case 'image':
        if (tableElement) {
          await exportTableToImage(tableElement, `${baseFilename}.png`);
        } else {
          alert('Élément de tableau requis pour l\'export en image');
        }
        break;
      default:
        console.error('Format non supporté:', format);
        alert(`Format d'export non supporté: ${format}`);
    }
  } catch (error) {
    // Les erreurs sont déjà gérées dans les fonctions individuelles
    // Ne rien faire ici pour éviter les messages d'erreur dupliqués
  }
}