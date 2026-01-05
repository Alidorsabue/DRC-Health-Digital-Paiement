'use client';

import { useState, useRef } from 'react';
import { useTableSortAndFilter } from '../hooks/useTableSortAndFilter';
import { exportData, ExportColumn, ExportRow } from '../utils/export';
import { useTranslation } from '../hooks/useTranslation';

export interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  filterType?: 'text' | 'select'; // Type de filtre: texte ou sélection multiple
  render?: (value: any, row: any) => React.ReactNode;
}

interface DataTableProps {
  data: any[];
  columns: Column[];
  title?: string;
  exportFilename?: string;
  // Support pour les checkboxes
  selectable?: boolean;
  selectedItems?: Set<string>;
  onSelectItem?: (id: string) => void;
  onSelectAll?: () => void;
  getRowId?: (row: any) => string;
  // Support pour les actions personnalisées par ligne
  actions?: (row: any) => React.ReactNode;
  // Support pour désactiver certaines lignes
  isRowDisabled?: (row: any) => boolean;
  // Masquer le header par défaut si un header personnalisé est fourni
  hideHeader?: boolean;
}

export default function DataTable({ 
  data, 
  columns, 
  title, 
  exportFilename,
  selectable = false,
  selectedItems = new Set(),
  onSelectItem,
  onSelectAll,
  getRowId = (row) => row.id || String(row),
  actions,
  isRowDisabled = () => false,
  hideHeader = false,
}: DataTableProps) {
  const { processedData, sortState, filters, handleSort, handleFilter } = useTableSortAndFilter(data);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [openSelectFilters, setOpenSelectFilters] = useState<Set<string>>(new Set());
  const [tempSelectFilters, setTempSelectFilters] = useState<Record<string, string[]>>({});
  const tableRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  // Extraire les valeurs uniques pour chaque colonne catégorielle
  const getUniqueValues = (columnKey: string): string[] => {
    const values = new Set<string>();
    data.forEach((row) => {
      const value = row[columnKey];
      if (value !== null && value !== undefined && value !== '') {
        const stringValue = String(value).trim();
        if (stringValue) {
          values.add(stringValue);
        }
      }
    });
    return Array.from(values).sort();
  };

  // Préparer les colonnes pour l'export
  const exportColumns: ExportColumn[] = columns.map((col) => ({
    key: col.key,
    label: col.label,
  }));

  // Préparer les données pour l'export (sans le rendu personnalisé)
  const exportDataRows: ExportRow[] = processedData.map((row) => {
    const exportRow: ExportRow = {};
    columns.forEach((col) => {
      // Extraire la valeur textuelle si c'est un rendu personnalisé
      if (col.render) {
        const rendered = col.render(row[col.key], row);
        // Essayer d'extraire le texte
        if (typeof rendered === 'string') {
          exportRow[col.key] = rendered;
        } else if (rendered && typeof rendered === 'object' && 'props' in rendered) {
          exportRow[col.key] = rendered.props?.children || row[col.key] || '';
        } else {
          exportRow[col.key] = row[col.key] || '';
        }
      } else {
        exportRow[col.key] = row[col.key] || '';
      }
    });
    return exportRow;
  });

  const handleExport = async (format: 'csv' | 'excel' | 'pdf' | 'image') => {
    setShowExportMenu(false);
    
    const tableElement = tableRef.current?.querySelector('table') || undefined;
    const filename = exportFilename || title || 'export';
    
    await exportData(
      format,
      exportDataRows,
      exportColumns,
      filename,
      tableElement as HTMLElement | undefined,
      title
    );
  };

  const getSortIcon = (columnKey: string) => {
    if (sortState.column !== columnKey) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    if (sortState.direction === 'asc') {
      return (
        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  return (
    <div className={hideHeader ? '' : 'bg-white rounded-lg shadow overflow-hidden'}>
      {/* En-tête avec titre et bouton d'export */}
      {!hideHeader && (
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-900">
          {title || 'Tableau'} ({processedData.length})
        </h2>
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Exporter
          </button>
          
          {showExportMenu && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowExportMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-20 border border-gray-200">
                <div className="py-1">
                  <button
                    onClick={() => handleExport('csv')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    CSV
                  </button>
                  <button
                    onClick={() => handleExport('excel')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Excel (XLSX)
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    PDF
                  </button>
                  <button
                    onClick={() => handleExport('image')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Image (PNG)
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      )}

      {/* Tableau avec tri et filtres */}
      <div ref={tableRef} className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="inline-block min-w-full align-middle">
          <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {selectable && (
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={processedData.length > 0 && processedData.every(row => selectedItems.has(getRowId(row)))}
                        onChange={onSelectAll}
                        className="rounded"
                      />
                    </th>
                  )}
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      <div className="flex flex-col gap-1 sm:gap-2">
                        {/* En-tête avec tri */}
                        <div className="flex items-center gap-1 sm:gap-2">
                          <span className="truncate">{column.label}</span>
                      {column.sortable !== false && (
                        <button
                          onClick={() => handleSort(column.key)}
                          className="hover:text-gray-700 transition-colors flex-shrink-0"
                          title={t('common.sort')}
                        >
                          {getSortIcon(column.key)}
                        </button>
                      )}
                    </div>
                    {/* Filtre */}
                    {column.filterable !== false && (
                      column.filterType === 'select' ? (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              const newOpen = new Set(openSelectFilters);
                              if (newOpen.has(column.key)) {
                                // Fermer le dropdown et appliquer les filtres temporaires
                                const tempValues = tempSelectFilters[column.key];
                                if (tempValues !== undefined) {
                                  handleFilter(column.key, tempValues);
                                  const newTemp = { ...tempSelectFilters };
                                  delete newTemp[column.key];
                                  setTempSelectFilters(newTemp);
                                }
                                newOpen.delete(column.key);
                              } else {
                                // Ouvrir le dropdown et initialiser les valeurs temporaires
                                const currentFilter = filters[column.key];
                                const currentValues = Array.isArray(currentFilter) ? currentFilter : [];
                                const newTemp: Record<string, string[]> = {
                                  ...tempSelectFilters,
                                  [column.key]: currentValues.slice(),
                                };
                                setTempSelectFilters(newTemp);
                                newOpen.add(column.key);
                              }
                              setOpenSelectFilters(newOpen);
                            }}
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-900 text-left flex items-center justify-between"
                          >
                            <span className="truncate text-gray-900">
                              {Array.isArray(filters[column.key]) && filters[column.key].length > 0
                                ? `${filters[column.key].length} sélectionné(s)`
                                : 'Tous'}
                            </span>
                            <svg className="w-3 h-3 ml-1 flex-shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {openSelectFilters.has(column.key) && (
                            <>
                              <div 
                                className="fixed inset-0 z-10" 
                                onClick={() => {
                                  // Appliquer les filtres temporaires avant de fermer
                                  const tempValues = tempSelectFilters[column.key];
                                  if (tempValues !== undefined) {
                                    handleFilter(column.key, tempValues);
                                    const newTemp = { ...tempSelectFilters };
                                    delete newTemp[column.key];
                                    setTempSelectFilters(newTemp);
                                  }
                                  const newOpen = new Set(openSelectFilters);
                                  newOpen.delete(column.key);
                                  setOpenSelectFilters(newOpen);
                                }}
                              />
                              <div className="absolute z-20 mt-1 w-full bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-auto">
                                <div className="p-2">
                                  {(() => {
                                  const currentFilter = filters[column.key];
                                  const currentFilterArray = Array.isArray(currentFilter) ? currentFilter : [];
                                  const tempValues = tempSelectFilters[column.key] !== undefined 
                                    ? tempSelectFilters[column.key] 
                                    : currentFilterArray;
                                  return (
                                    <>
                                      <label className="flex items-center px-2 py-1 hover:bg-gray-100 rounded cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={tempValues.length === 0}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              const newTemp: Record<string, string[]> = {
                                                ...tempSelectFilters,
                                                [column.key]: [],
                                              };
                                              setTempSelectFilters(newTemp);
                                            }
                                          }}
                                          className="mr-2 rounded"
                                        />
                                        <span className="text-xs text-gray-900">Tous</span>
                                      </label>
                                      {getUniqueValues(column.key).map((value) => {
                                        const isChecked = tempValues.includes(value);
                                        return (
                                          <label key={value} className="flex items-center px-2 py-1 hover:bg-gray-100 rounded cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={(e) => {
                                                const currentFilter = filters[column.key];
                                                const currentFilterArray = Array.isArray(currentFilter) ? currentFilter : [];
                                                const currentTemp = tempSelectFilters[column.key] !== undefined
                                                  ? tempSelectFilters[column.key]
                                                  : currentFilterArray;
                                                let newTempValues: string[];
                                                if (e.target.checked) {
                                                  newTempValues = [...currentTemp, value];
                                                } else {
                                                  newTempValues = currentTemp.filter((v: string) => v !== value);
                                                }
                                                const newTemp: Record<string, string[]> = {
                                                  ...tempSelectFilters,
                                                  [column.key]: newTempValues,
                                                };
                                                setTempSelectFilters(newTemp);
                                              }}
                                              className="mr-2 rounded"
                                            />
                                            <span className="text-xs text-gray-900 truncate">{value}</span>
                                          </label>
                                        );
                                      })}
                                    </>
                                  );
                                })()}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <input
                          type="text"
                          placeholder={t('common.filterPlaceholder')}
                          value={typeof filters[column.key] === 'string' ? filters[column.key] : ''}
                          onChange={(e) => handleFilter(column.key, e.target.value)}
                          className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                        />
                      )
                    )}
                      </div>
                    </th>
                  ))}
                  {actions && (
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('common.actions')}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {processedData.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)} className="px-3 sm:px-6 py-4 text-center text-xs sm:text-sm text-gray-500">
                      {t('common.noDataAvailable')}
                    </td>
                  </tr>
                ) : (
                  processedData.map((row, index) => {
                    const rowId = getRowId(row);
                    const isSelected = selectedItems.has(rowId);
                    const isDisabled = isRowDisabled(row);
                    
                    return (
                      <tr 
                        key={index} 
                        className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''} ${isDisabled ? 'opacity-50' : ''}`}
                      >
                        {selectable && (
                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => onSelectItem?.(rowId)}
                              className="rounded"
                              disabled={isDisabled}
                            />
                          </td>
                        )}
                        {columns.map((column) => (
                          <td key={column.key} className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900">
                            <div className="truncate max-w-xs sm:max-w-none">
                              {column.render
                                ? column.render(row[column.key], row)
                                : String(row[column.key] || 'N/A')}
                            </div>
                          </td>
                        ))}
                        {actions && (
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-500">
                            {actions(row)}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}