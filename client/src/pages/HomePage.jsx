import { useState } from 'react';
import { SearchIcon } from '../icons.jsx';
import Autocomplete from '../components/Autocomplete.jsx';
import fornecedores from '../data/fornecedores.json';
import segmentos from '../data/segmentos.json';

const seguimentoOptions = Object.keys(segmentos);
const seguimentoMatchText = (categoria) => [categoria, ...segmentos[categoria]].join(' ');

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
              showLetterBar
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
