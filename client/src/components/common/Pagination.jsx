import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const Pagination = ({ 
  pagination, 
  onPageChange, 
  onLimitChange,
  pageSizeOptions = [15, 20, 50, 100, 200]
}) => {
  if (!pagination || pagination.total === 0) {
    return null;
  }

  const { page = 1, totalPages = 1, total = 0, limit = 20 } = pagination;
  const startRow = Math.min((page - 1) * limit + 1, total);
  const endRow = Math.min(page * limit, total);

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages = [];
    const maxButtons = 5;
    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, start + maxButtons - 1);

    if (end - start < maxButtons - 1) {
      start = Math.max(1, end - maxButtons + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="pagination-wrapper">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div className="pagination-info">
          Showing <strong>{startRow}</strong> to <strong>{endRow}</strong> of <strong>{total}</strong> records
        </div>

        {onLimitChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', color: 'var(--slate-600)' }}>
            <span>Show:</span>
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="form-select"
              style={{
                width: 'auto',
                padding: '0.25rem 0.6rem',
                fontSize: '0.8125rem',
                fontWeight: '600',
                borderRadius: 'var(--radius-sm)',
                borderColor: 'var(--slate-300)',
                background: '#ffffff'
              }}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / page
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination-controls">
          <button
            type="button"
            className="pagination-btn"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            title="Previous Page"
          >
            <ChevronLeft size={16} />
          </button>

          {getPageNumbers().map((num) => (
            <button
              type="button"
              key={num}
              className={`pagination-btn ${num === page ? 'active' : ''}`}
              onClick={() => onPageChange(num)}
            >
              {num}
            </button>
          ))}

          <button
            type="button"
            className="pagination-btn"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            title="Next Page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

