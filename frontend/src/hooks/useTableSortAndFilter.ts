import { useState, useMemo } from 'react';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortState {
  column: string | null;
  direction: SortDirection;
}

export interface FilterState {
  [column: string]: string | string[];
}

export interface Column {
  key: string;
  render?: (value: any, row: any) => React.ReactNode;
}

/**
 * Hook personnalisé pour le tri et le filtrage des tableaux
 */
export function useTableSortAndFilter<T extends Record<string, any>>(
  data: T[],
  columns?: Column[]
) {
  const [sortState, setSortState] = useState<SortState>({
    column: null,
    direction: null,
  });

  const [filters, setFilters] = useState<FilterState>({});

  /**
   * Toggle le tri pour une colonne
   */
  const handleSort = (column: string) => {
    setSortState((prev) => {
      if (prev.column === column) {
        // Cycle: asc -> desc -> null
        if (prev.direction === 'asc') {
          return { column, direction: 'desc' };
        } else if (prev.direction === 'desc') {
          return { column: null, direction: null };
        }
      }
      return { column, direction: 'asc' };
    });
  };

  /**
   * Met à jour le filtre pour une colonne
   */
  const handleFilter = (column: string, value: string | string[]) => {
    setFilters((prev) => {
      const newFilters = { ...prev };
      if (Array.isArray(value) && value.length === 0) {
        delete newFilters[column];
      } else if (typeof value === 'string' && value === '') {
        delete newFilters[column];
      } else {
        newFilters[column] = value;
      }
      return newFilters;
    });
  };

  /**
   * Réinitialise tous les filtres
   */
  const clearFilters = () => {
    setFilters({});
  };

  /**
   * Réinitialise le tri
   */
  const clearSort = () => {
    setSortState({ column: null, direction: null });
  };

  /**
   * Données filtrées et triées
   */
  const processedData = useMemo(() => {
    let result = [...data];

    // Appliquer les filtres
    Object.entries(filters).forEach(([column, filterValue]) => {
      if (filterValue) {
        const col = columns?.find(c => c.key === column);
        
        if (Array.isArray(filterValue)) {
          // Filtre de sélection multiple
          if (filterValue.length > 0) {
            result = result.filter((row) => {
              // Utiliser la valeur rendue si disponible, sinon la valeur brute
              let cellValue: string;
              if (col?.render) {
                cellValue = String(row[`_rendered_${column}`] || row[column] || '').toLowerCase();
              } else {
                cellValue = String(row[column] || '').toLowerCase();
              }
              return filterValue.some(fv => cellValue === fv.toLowerCase() || cellValue.includes(fv.toLowerCase()));
            });
          }
        } else {
          // Filtre texte
          result = result.filter((row) => {
            // Utiliser la valeur rendue si disponible, sinon la valeur brute
            let cellValue: string;
            if (col?.render) {
              cellValue = String(row[`_rendered_${column}`] || row[column] || '').toLowerCase();
            } else {
              cellValue = String(row[column] || '').toLowerCase();
            }
            return cellValue.includes(filterValue.toLowerCase());
          });
        }
      }
    });

    // Appliquer le tri
    if (sortState.column && sortState.direction) {
      result.sort((a, b) => {
        const aValue = a[sortState.column!];
        const bValue = b[sortState.column!];

        // Gérer les valeurs nulles/undefined
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return 1;
        if (bValue == null) return -1;

        // Comparaison selon le type
        let comparison = 0;
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue;
        } else {
          comparison = String(aValue).localeCompare(String(bValue));
        }

        return sortState.direction === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [data, filters, sortState, columns]);

  return {
    processedData,
    sortState,
    filters,
    handleSort,
    handleFilter,
    clearFilters,
    clearSort,
  };
}