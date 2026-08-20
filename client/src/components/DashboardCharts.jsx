import { useMemo, useState } from 'react';

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const compactCurrencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const DIMENSION_OPTIONS = [
  { key: 'ures', label: 'Unidade Gestora' },
  { key: 'assuntoPlanejado', label: 'Assunto Planejado' },
  { key: 'credor', label: 'Credor' },
  { key: 'cnpj', label: 'CNPJ' },
];

const METRIC_OPTIONS = [
  { key: 'valorTotalVigencia', label: 'Valor Total Vigência', kind: 'currency' },
  { key: 'valorTotalPago', label: 'Valor Total Pago', kind: 'currency' },
  { key: 'percPago', label: '% Pago', kind: 'percent' },
  { key: 'valorPendente', label: 'Valor Pendente Pagamento', kind: 'currency' },
  { key: 'percPendente', label: '% Pendente', kind: 'percent' },
];

const MAX_BARS = 8;

function formatMetricValue(value, metric) {
  return metric.kind === 'percent' ? `${value.toFixed(1)}%` : compactCurrencyFormatter.format(value);
}

function formatMetricTooltip(value, metric) {
  return metric.kind === 'percent' ? `${value.toFixed(2)}%` : currencyFormatter.format(value);
}

function pickBreakdownDimension(results) {
  let best = null;
  for (const dim of DIMENSION_OPTIONS) {
    const distinct = new Set(results.map((r) => r[dim.key]).filter(Boolean)).size;
    if (!best || distinct > best.distinct) {
      best = { ...dim, distinct };
    }
  }
  return best;
}

function countDistinct(results, dimensionKey) {
  return new Set(results.map((r) => r[dimensionKey]).filter(Boolean)).size;
}

function buildBreakdown(results, dimensionKey, metric) {
  const groups = new Map();
  for (const contrato of results) {
    const key = contrato[dimensionKey] || '—';
    const entry = groups.get(key) || { sum: 0, count: 0 };
    entry.sum += contrato[metric.key] || 0;
    entry.count += 1;
    groups.set(key, entry);
  }
  const valueOf = (entry) => (metric.kind === 'percent' ? entry.sum / entry.count : entry.sum);
  const sorted = [...groups.entries()].sort((a, b) => valueOf(b[1]) - valueOf(a[1]));
  const top = sorted.slice(0, MAX_BARS).map(([label, entry]) => [label, valueOf(entry)]);
  const rest = sorted.slice(MAX_BARS);
  if (rest.length > 0) {
    const restEntry = rest.reduce(
      (acc, [, entry]) => ({ sum: acc.sum + entry.sum, count: acc.count + entry.count }),
      { sum: 0, count: 0 }
    );
    top.push([`Outros (${rest.length})`, valueOf(restEntry)]);
  }
  const max = top.reduce((m, [, value]) => Math.max(m, Math.abs(value)), 0) || 1;
  return top.map(([label, value]) => ({ label, value, pct: (Math.abs(value) / max) * 100 }));
}

function meterTone(pct) {
  return pct >= 60 ? 'green' : pct >= 30 ? 'yellow' : 'red';
}

export default function DashboardCharts({ results, summary }) {
  const [selectedDimension, setSelectedDimension] = useState(() => pickBreakdownDimension(results).key);
  const [selectedMetric, setSelectedMetric] = useState('valorTotalVigencia');

  const dimension = DIMENSION_OPTIONS.find((d) => d.key === selectedDimension);
  const metric = METRIC_OPTIONS.find((m) => m.key === selectedMetric);

  const distinct = useMemo(() => countDistinct(results, selectedDimension), [results, selectedDimension]);
  const breakdown = useMemo(
    () => (distinct > 1 ? buildBreakdown(results, selectedDimension, metric) : null),
    [results, selectedDimension, metric, distinct]
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

      <div className="dash-card dash-bars-card">
        <div className="dash-bars-header">
          <h3 className="dash-card-title">
            {breakdown ? `Top ${breakdown.length} por ${dimension.label}` : `Por ${dimension.label}`} · {metric.label}
          </h3>
          <div className="dash-bars-controls">
            <label className="dash-select-label">
              Agrupar por
              <select value={selectedDimension} onChange={(e) => setSelectedDimension(e.target.value)}>
                {DIMENSION_OPTIONS.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="dash-select-label">
              Métrica
              <select value={selectedMetric} onChange={(e) => setSelectedMetric(e.target.value)}>
                {METRIC_OPTIONS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {breakdown ? (
          <div className="dash-bars">
            {breakdown.map((row) => (
              <div className="dash-bar-row" key={row.label}>
                <span className="dash-bar-label" title={row.label}>
                  {row.label}
                </span>
                <div className="dash-bar-track">
                  <div
                    className="dash-bar-fill"
                    style={{ width: `${row.pct}%` }}
                    title={`${row.label}: ${formatMetricTooltip(row.value, metric)}`}
                  />
                </div>
                <span className="dash-bar-value">{formatMetricValue(row.value, metric)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="dash-bars-empty">Apenas um valor distinto de {dimension.label} no resultado atual.</p>
        )}
      </div>
    </div>
  );
}
