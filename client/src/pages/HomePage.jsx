import { useEffect, useMemo, useRef, useState } from 'react';
import { SearchIcon, WalletIcon, CheckCircleIcon, PercentIcon, ClockAlertIcon } from '../icons.jsx';
import Autocomplete from '../components/Autocomplete.jsx';
import ColumnFilterPanel from '../components/ColumnFilterPanel.jsx';
import fornecedores from '../data/fornecedores.json';
import segmentos from '../data/segmentos.json';
import contratos from '../data/contratos.json';

const seguimentoOptions = Object.keys(segmentos);
const seguimentoMatchText = (categoria) => [categoria, ...segmentos[categoria]].join(' ');

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

const uresOptions = uniqueSorted(contratos.map((c) => c.ures));
const assuntoPlanejadoOptions = uniqueSorted(contratos.map((c) => c.assuntoPlanejado));
const cnpjOptions = uniqueSorted(contratos.map((c) => c.cnpj));

const COLUMN_FILTER_FIELDS = [
  { key: 'ures', label: 'Unidade Gestora', options: uresOptions },
  { key: 'assuntoPlanejado', label: 'Assunto Planejado', options: assuntoPlanejadoOptions },
  { key: 'credor', label: 'Credor', options: fornecedores },
  { key: 'cnpj', label: 'CNPJ', options: cnpjOptions },
];

const EMPTY_COLUMN_FILTERS = { ures: [], assuntoPlanejado: [], credor: [], cnpj: [] };

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatCurrency = (value) => currencyFormatter.format(value || 0);
const formatPercent = (value) => `${Number(value || 0).toFixed(2)}%`;

const COLUMNS = [
  { key: 'ures', label: 'URES' },
  { key: 'assuntoPlanejado', label: 'Assunto Planejado' },
  { key: 'inicioVigencia', label: 'Início Vigência' },
  { key: 'fimVigencia', label: 'Final Vigência' },
  { key: 'credor', label: 'Credor' },
  { key: 'cnpj', label: 'CNPJ' },
  { key: 'dataOriginaria', label: 'Data Originária' },
  { key: 'mesesAndamento', label: 'Meses em Andamento' },
  { key: 'valorTotalVigencia', label: 'Valor Total Vigência', format: formatCurrency },
  { key: 'valorTotalPago', label: 'Valor Total Pago', format: formatCurrency },
  { key: 'percPago', label: '% Pago', format: formatPercent },
  { key: 'valorPendente', label: 'Valor Pendente Pagamento', format: formatCurrency },
  { key: 'percPendente', label: '% Pendente', format: formatPercent },
  { key: 'dataCarga', label: 'Data da Carga' },
];

const SUMMARY_CARDS = [
  { key: 'totalVigencia', label: 'Valor Total Vigência', icon: WalletIcon, tone: 'blue', format: formatCurrency },
  { key: 'totalPago', label: 'Valor Total Pago', icon: CheckCircleIcon, tone: 'green', format: formatCurrency },
  { key: 'mediaPercPago', label: '% Pago (média)', icon: PercentIcon, tone: 'green', format: formatPercent },
  { key: 'totalPendente', label: 'Valor Pendente Pagamento', icon: ClockAlertIcon, tone: 'red', format: formatCurrency },
  { key: 'mediaPercPendente', label: '% Pendente (média)', icon: PercentIcon, tone: 'red', format: formatPercent },
];

const PAGE_SIZE_OPTIONS = [25, 50, 100, 'all'];
const LOADING_DELAY_MS = 700;

function getPageNumbers(current, total) {
  const delta = 2;
  const range = [];
  for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) {
    range.push(i);
  }
  if (range[0] > 1) {
    if (range[0] > 2) range.unshift('...');
    range.unshift(1);
  }
  if (range[range.length - 1] < total) {
    if (range[range.length - 1] < total - 1) range.push('...');
    range.push(total);
  }
  return range;
}

export default function HomePage() {
  const [fornecedor, setFornecedor] = useState('');
  const [seguimento, setSeguimento] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [columnFilters, setColumnFilters] = useState(EMPTY_COLUMN_FILTERS);

  const isFornecedorSelected = fornecedores.includes(fornecedor);
  const isSeguimentoSelected = seguimentoOptions.includes(seguimento);
  const hasColumnFilters = COLUMN_FILTER_FIELDS.some((f) => columnFilters[f.key].length > 0);
  const hasFilters = fornecedor !== '' || seguimento !== '' || hasColumnFilters;

  function handleClearFilters() {
    setFornecedor('');
    setSeguimento('');
    setColumnFilters(EMPTY_COLUMN_FILTERS);
    setPage(1);
  }

  function handleFornecedorChange(value) {
    setFornecedor(value);
    if (fornecedores.includes(value)) {
      setSeguimento('');
      setColumnFilters(EMPTY_COLUMN_FILTERS);
    }
    setPage(1);
  }

  function handleSeguimentoChange(value) {
    setSeguimento(value);
    if (seguimentoOptions.includes(value)) {
      setFornecedor('');
      setColumnFilters(EMPTY_COLUMN_FILTERS);
    }
    setPage(1);
  }

  function handleColumnFiltersChange(next) {
    setColumnFilters(next);
    if (COLUMN_FILTER_FIELDS.some((f) => next[f.key].length > 0)) {
      setFornecedor('');
      setSeguimento('');
    }
    setPage(1);
  }

  function handlePageSizeChange(value) {
    setPageSize(value === 'all' ? 'all' : Number(value));
    setPage(1);
  }

  const results = useMemo(() => {
    if (hasColumnFilters) {
      return contratos.filter((contrato) =>
        COLUMN_FILTER_FIELDS.every((f) => {
          const selected = columnFilters[f.key];
          return selected.length === 0 || selected.includes(contrato[f.key]);
        })
      );
    }
    if (!isFornecedorSelected && !isSeguimentoSelected) return null;
    const assuntosDoSegmento = isSeguimentoSelected ? new Set(segmentos[seguimento]) : null;
    return contratos.filter((contrato) => {
      if (isFornecedorSelected && contrato.credor !== fornecedor) return false;
      if (assuntosDoSegmento && !assuntosDoSegmento.has(contrato.assuntoPlanejado)) return false;
      return true;
    });
  }, [fornecedor, seguimento, isFornecedorSelected, isSeguimentoSelected, hasColumnFilters, columnFilters]);

  const [isLoading, setIsLoading] = useState(false);
  const [displayResults, setDisplayResults] = useState(results);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setDisplayResults(results);
      return;
    }
    setIsLoading(true);
    const timer = setTimeout(() => {
      setDisplayResults(results);
      setIsLoading(false);
    }, LOADING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [results]);

  const pageCount = displayResults && pageSize !== 'all' ? Math.max(1, Math.ceil(displayResults.length / pageSize)) : 1;
  const currentPage = Math.min(page, pageCount);
  const pageStart = pageSize === 'all' ? 0 : (currentPage - 1) * pageSize;
  const pageEnd = pageSize === 'all' ? displayResults?.length ?? 0 : Math.min(pageStart + pageSize, displayResults?.length ?? 0);
  const pageResults = useMemo(() => {
    if (!displayResults) return [];
    return pageSize === 'all' ? displayResults : displayResults.slice(pageStart, pageStart + pageSize);
  }, [displayResults, pageSize, pageStart]);

  const summary = useMemo(() => {
    if (!displayResults || displayResults.length === 0) return null;
    const n = displayResults.length;
    const sum = (key) => displayResults.reduce((total, c) => total + (c[key] || 0), 0);
    return {
      totalVigencia: sum('valorTotalVigencia'),
      totalPago: sum('valorTotalPago'),
      totalPendente: sum('valorPendente'),
      mediaPercPago: sum('percPago') / n,
      mediaPercPendente: sum('percPendente') / n,
    };
  }, [displayResults]);

  return (
    <div className={`home-page${displayResults ? ' home-page--results' : ''}`}>
      {isLoading && (
        <div className="home-loading-overlay">
          <div className="home-spinner" />
        </div>
      )}
      <header className="home-header">
        <img className="home-emblem" src="/brasao-sp.png" alt="Brasão do Estado de São Paulo" />
        <div className="home-brand">
          <span className="home-brand-top">Seduc SP</span>
          <span className="home-brand-bottom">Audit</span>
        </div>
      </header>

      <div className="home-searches">
        <div className="home-search-field">
          <label className="home-search-label" htmlFor="search-fornecedor">
            Busca por Fornecedor
          </label>
          <div className="home-search-row">
            <Autocomplete
              id="search-fornecedor"
              options={fornecedores}
              value={fornecedor}
              onChange={handleFornecedorChange}
              showLetterBar
            />
            <span className="home-search-icon" aria-hidden="true">
              <SearchIcon />
            </span>
          </div>
        </div>

        <div className="home-search-field">
          <label className="home-search-label" htmlFor="search-seguimento">
            Busca por Seguimento
          </label>
          <div className="home-search-row">
            <Autocomplete
              id="search-seguimento"
              options={seguimentoOptions}
              value={seguimento}
              onChange={handleSeguimentoChange}
              matchText={seguimentoMatchText}
            />
            <span className="home-search-icon" aria-hidden="true">
              <SearchIcon />
            </span>
          </div>
        </div>
      </div>

      <div className="home-actions">
        <ColumnFilterPanel fields={COLUMN_FILTER_FIELDS} value={columnFilters} onChange={handleColumnFiltersChange} />
        {hasFilters && (
          <button type="button" className="home-clear-button" onClick={handleClearFilters}>
            Limpar filtros
          </button>
        )}
      </div>

      {displayResults && (
        <section className="home-results">
          <div className="home-results-header">
            <h2 className="home-results-title">
              {displayResults.length} contrato{displayResults.length === 1 ? '' : 's'} encontrado{displayResults.length === 1 ? '' : 's'}
            </h2>
            {displayResults.length > 0 && (
              <label className="home-page-size">
                Exibir
                <select value={pageSize} onChange={(e) => handlePageSizeChange(e.target.value)}>
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option === 'all' ? 'Todos' : option}
                    </option>
                  ))}
                </select>
                por página
              </label>
            )}
          </div>
          {displayResults.length === 0 ? (
            <p className="home-results-empty">Nenhum contrato encontrado para esse filtro.</p>
          ) : (
            <>
              <div className="home-summary">
                {SUMMARY_CARDS.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div key={card.key} className={`home-summary-card home-summary-card--${card.tone}`}>
                      <span className="home-summary-icon" aria-hidden="true">
                        <Icon />
                      </span>
                      <div className="home-summary-text">
                        <span className="home-summary-label">{card.label}</span>
                        <span className="home-summary-value">{card.format(summary[card.key])}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="users-table users-table--compact users-table--cards">
                <table>
                  <thead>
                    <tr>
                      {COLUMNS.map((col) => (
                        <th key={col.key}>{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageResults.map((contrato, i) => (
                      <tr key={pageStart + i}>
                        {COLUMNS.map((col) => (
                          <td key={col.key}>{col.format ? col.format(contrato[col.key]) : contrato[col.key]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pageSize !== 'all' && pageCount > 1 && (
                <div className="home-pagination">
                  <button
                    type="button"
                    className="home-pagination-button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </button>
                  <span className="home-pagination-info">
                    {pageStart + 1}–{pageEnd} de {displayResults.length} · página {currentPage} de {pageCount}
                  </span>
                  <button
                    type="button"
                    className="home-pagination-button"
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    disabled={currentPage === pageCount}
                  >
                    Próxima
                  </button>
                </div>
              )}
              {pageSize !== 'all' && pageCount > 1 && (
                <div className="home-pagination-numbers">
                  {getPageNumbers(currentPage, pageCount).map((item, i) =>
                    item === '...' ? (
                      <span key={`ellipsis-${i}`} className="home-pagination-ellipsis">
                        …
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        className={`home-pagination-page${item === currentPage ? ' is-active' : ''}`}
                        onClick={() => setPage(item)}
                      >
                        {item}
                      </button>
                    )
                  )}
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
