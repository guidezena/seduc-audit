import { useMemo } from 'react';

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const compactCurrencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const BREAKDOWN_DIMENSIONS = [
  { key: 'ures', label: 'Unidade Gestora' },
  { key: 'assuntoPlanejado', label: 'Assunto Planejado' },
  { key: 'credor', label: 'Credor' },
];

const MAX_BARS = 8;

function pickBreakdownDimension(results) {
  let best = null;
  for (const dim of BREAKDOWN_DIMENSIONS) {
    const distinct = new Set(results.map((r) => r[dim.key]).filter(Boolean)).size;
    if (!best || distinct > best.distinct) {
      best = { ...dim, distinct };
    }
  }
  return best;
}

function buildBreakdown(results, dimensionKey) {
  const totals = new Map();
  for (const contrato of results) {
    const key = contrato[dimensionKey] || '—';
    totals.set(key, (totals.get(key) || 0) + (contrato.valorTotalVigencia || 0));
  }
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, MAX_BARS);
  const rest = sorted.slice(MAX_BARS);
  if (rest.length > 0) {
    const restTotal = rest.reduce((sum, [, value]) => sum + value, 0);
    top.push([`Outros (${rest.length})`, restTotal]);
  }
  const max = top.reduce((m, [, value]) => Math.max(m, value), 0) || 1;
  return top.map(([label, value]) => ({ label, value, pct: (value / max) * 100 }));
}

function meterTone(pct) {
  return pct >= 60 ? 'green' : pct >= 30 ? 'yellow' : 'red';
}

export default function DashboardCharts({ results, summary }) {
  const dimension = useMemo(() => pickBreakdownDimension(results), [results]);
  const breakdown = useMemo(
    () => (dimension && dimension.distinct > 1 ? buildBreakdown(results, dimension.key) : null),
    [results, dimension]
  );

  const pago = Math.max(0, Math.min(100, summary.mediaPercPago));
  const tone = meterTone(pago);

  return (
    <div className="home-dashboard">
      <div className="dash-card dash-meter-card">
        <h3 className="dash-card-title">Taxa de pagamento (média)</h3>
        <div className="dash-meter">
          <div className="dash-meter-track">
            <div className={`dash-meter-fill dash-meter-fill--${tone}`} style={{ width: `${pago}%` }} />
          </div>
          <span className={`dash-meter-value dash-meter-value--${tone}`}>{pago.toFixed(1)}%</span>
        </div>
        <p className="dash-meter-caption">
          {currencyFormatter.format(summary.totalPago)} pagos de {currencyFormatter.format(summary.totalVigencia)} em vigência
        </p>
      </div>

      {breakdown && (
        <div className="dash-card dash-bars-card">
          <h3 className="dash-card-title">Top {breakdown.length} por {dimension.label} · Valor Total Vigência</h3>
          <div className="dash-bars">
            {breakdown.map((row) => (
              <div className="dash-bar-row" key={row.label}>
                <span className="dash-bar-label" title={row.label}>
                  {row.label}
                </span>
                <div className="dash-bar-track">
                  <div className="dash-bar-fill" style={{ width: `${row.pct}%` }} title={`${row.label}: ${currencyFormatter.format(row.value)}`} />
                </div>
                <span className="dash-bar-value">{compactCurrencyFormatter.format(row.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
