import { useState } from 'react';
import { SearchIcon } from '../icons.jsx';

export default function HomePage() {
  const [fornecedor, setFornecedor] = useState('');
  const [seguimento, setSeguimento] = useState('');

  return (
    <div className="home-page">
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
            <input
              id="search-fornecedor"
              placeholder=""
              value={fornecedor}
              onChange={(e) => setFornecedor(e.target.value)}
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
            <input
              id="search-seguimento"
              placeholder=""
              value={seguimento}
              onChange={(e) => setSeguimento(e.target.value)}
            />
            <span className="home-search-icon" aria-hidden="true">
              <SearchIcon />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
