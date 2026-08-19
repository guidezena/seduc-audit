import { useMemo, useState } from 'react';
import { SearchIcon } from '../icons.jsx';
import Autocomplete from '../components/Autocomplete.jsx';
import fornecedores from '../data/fornecedores.json';
import segmentos from '../data/segmentos.json';
import contratos from '../data/contratos.json';

const seguimentoOptions = Object.keys(segmentos);
const seguimentoMatchText = (categoria) => [categoria, ...segmentos[categoria]].join(' ');

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

export default function HomePage() {
  const [fornecedor, setFornecedor] = useState('');
  const [seguimento, setSeguimento] = useState('');

  const isFornecedorSelected = fornecedores.includes(fornecedor);
  const isSeguimentoSelected = seguimentoOptions.includes(seguimento);

  const results = useMemo(() => {
    if (!isFornecedorSelected && !isSeguimentoSelected) return null;
    const assuntosDoSegmento = isSeguimentoSelected ? new Set(segmentos[seguimento]) : null;
    return contratos.filter((contrato) => {
      if (isFornecedorSelected && contrato.credor !== fornecedor) return false;
      if (assuntosDoSegmento && !assuntosDoSegmento.has(contrato.assuntoPlanejado)) return false;
      return true;
    });
  }, [fornecedor, seguimento, isFornecedorSelected, isSeguimentoSelected]);

  return (
    <div className={`home-page${results ? ' home-page--results' : ''}`}>
      <header className="home-header">
        <img className="home-emblem" src="/brasao-sp.png" alt="Brasão do Estado de São Paulo" />
        <div className="home-brand">
          <span className="home-brand-top">Seduc</span>
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
              onChange={setFornecedor}
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
              onChange={setSeguimento}
              matchText={seguimentoMatchText}
            />
            <span className="home-search-icon" aria-hidden="true">
              <SearchIcon />
            </span>
          </div>
        </div>
      </div>

      {results && (
        <section className="home-results">
          <h2 className="home-results-title">{results.length} contrato{results.length === 1 ? '' : 's'} encontrado{results.length === 1 ? '' : 's'}</h2>
          {results.length === 0 ? (
            <p className="home-results-empty">Nenhum contrato encontrado para esse filtro.</p>
          ) : (
            <div className="users-table">
              <table>
                <thead>
                  <tr>
                    {COLUMNS.map((col) => (
                      <th key={col.key}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((contrato, i) => (
                    <tr key={i}>
                      {COLUMNS.map((col) => (
                        <td key={col.key}>{col.format ? col.format(contrato[col.key]) : contrato[col.key]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
