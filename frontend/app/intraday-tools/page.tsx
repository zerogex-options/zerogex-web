/**
 * Intraday Trading Tools Page
 * VWAP, ORB, Volume Spikes, Momentum Divergence, etc.
 */

'use client';

import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApiData } from '@/hooks/useApiData';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import MetricCard from '@/components/MetricCard';
import { omitClosedMarketTimes } from '@/core/utils';
import { useTimeframe } from '@/core/TimeframeContext';

interface VwapDeviationRow {
  price: number;
  vwap: number;
  vwap_deviation_pct: number;
  vwap_position: string;
}

interface OpeningRangeRow {
  current_price: number;
  orb_high: number;
  distance_above_orb_high: number;
  orb_low: number;
  distance_below_orb_low: number;
  orb_range: number;
  orb_status: string;
}

interface VolumeSpikeRow {
  time_et: string;
  current_volume: number;
  volume_ratio: number;
  volume_sigma: number;
  volume_class: string;
}

interface DivergenceRow {
  time_et?: string;
  timestamp?: string;
  time?: string;
  time_window_end?: string;
  divergence_signal?: string;
  signal?: string;
  divergence_type?: string;
  price?: number;
}

interface SmartMoneyRow {
  timestamp: string;
  symbol: string;
  contract: string;
  strike: number;
  expiration: string;
  dte: number;
  option_type: string;
  flow: number;
  notional: number;
  delta?: number | null;
  score?: number | null;
  notional_class: string;
  size_class: string;
}

function extractDivergenceRows(payload: unknown): DivergenceRow[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as DivergenceRow[];
  if (typeof payload !== 'object') return [];

  const direct = payload as Record<string, unknown>;
  const preferredKeys = ['data', 'results', 'signals', 'rows', 'items'];
  for (const key of preferredKeys) {
    const candidate = direct[key];
    if (Array.isArray(candidate)) return candidate as DivergenceRow[];
    if (candidate && typeof candidate === 'object') {
      const nested = extractDivergenceRows(candidate);
      if (nested.length > 0) return nested;
    }
  }

  for (const value of Object.values(direct)) {
    if (Array.isArray(value)) return value as DivergenceRow[];
    if (value && typeof value === 'object') {
      const nested = extractDivergenceRows(value);
      if (nested.length > 0) return nested;
    }
  }

  return [];
}

export default function IntradayToolsPage() {
  const { symbol, timeframe, getMaxDataPoints } = useTimeframe();
  const [smartMoneyTimeframe, setSmartMoneyTimeframe] = useState('1min');
  const maxPoints = getMaxDataPoints();
  const divergenceWindowUnits = maxPoints;

  const { data: vwapData, loading: vwapLoading, error: vwapError } = useApiData<VwapDeviationRow[]>(
    `/api/trading/vwap-deviation?symbol=${symbol}&timeframe=${timeframe}&window_units=20`,
    { refreshInterval: 5000 }
  );

  const { data: orbData, loading: orbLoading, error: orbError } = useApiData<OpeningRangeRow[]>(
    `/api/trading/opening-range?symbol=${symbol}&timeframe=${timeframe}&window_units=20`,
    { refreshInterval: 5000 }
  );

  const { data: volumeSpikes } = useApiData<VolumeSpikeRow[]>(
    `/api/trading/volume-spikes?symbol=${symbol}&limit=5`,
    { refreshInterval: 10000 }
  );

  const { data: divergenceResponse } = useApiData<unknown>(
    `/api/trading/momentum-divergence?symbol=${symbol}&timeframe=${timeframe}&window_units=${divergenceWindowUnits}`,
    { refreshInterval: 5000 }
  );

  const { data: divergenceFallback } = useApiData<unknown>(
    `/api/trading/momentum-divergence?symbol=${symbol}`,
    { refreshInterval: 5000 }
  );

  const { data: divergenceDefault } = useApiData<unknown>(
    `/api/trading/momentum-divergence`,
    { refreshInterval: 5000 }
  );

  const { data: smartMoneyData, error: smartMoneyError } = useApiData<SmartMoneyRow[]>(
    `/api/flow/smart-money?symbol=${symbol}&timeframe=${smartMoneyTimeframe}&window_units=30&limit=30`,
    { refreshInterval: 10000 }
  );

  const primaryDivergence = extractDivergenceRows(divergenceResponse);
  const fallbackDivergence = extractDivergenceRows(divergenceFallback);
  const defaultDivergence = extractDivergenceRows(divergenceDefault);
  const divergence = [primaryDivergence, fallbackDivergence, defaultDivergence].find((rows) => rows.length > 0) || [];

  const vwap = vwapData?.[0];
  const orb = orbData?.[0];
  const divergenceMarketRows = omitClosedMarketTimes(divergence || [], (signal) => signal.time_et || signal.timestamp || signal.time_window_end || signal.time || '');

  const smartMoneyByStrike = useMemo(() => {
    const grouped = new Map<string, { strike: number; callNotional: number; putNotional: number; totalNotional: number }>();
    (smartMoneyData || []).forEach((row) => {
      const strike = Number(row.strike || 0);
      const key = strike.toFixed(2);
      if (!grouped.has(key)) {
        grouped.set(key, { strike, callNotional: 0, putNotional: 0, totalNotional: 0 });
      }
      const current = grouped.get(key)!;
      const notional = Number(row.notional || 0) / 1000000;
      if ((row.option_type || '').toLowerCase().includes('call')) {
        current.callNotional += notional;
      } else {
        current.putNotional += notional;
      }
      current.totalNotional += notional;
    });

    return Array.from(grouped.values())
      .sort((a, b) => b.totalNotional - a.totalNotional)
      .slice(0, 12);
  }, [smartMoneyData]);

  if ((vwapLoading || orbLoading) && !vwapData && !orbData) {
    return <LoadingSpinner size="lg" />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Intraday Trading Tools</h1>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">VWAP Analysis</h2>
        {vwapError ? (
          <ErrorMessage message={vwapError} />
        ) : !vwap ? (
          <div className="bg-[#423d3f] rounded-lg p-6 text-center text-gray-400">
            No VWAP data available (market may be closed)
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard title="Current Price" value={`$${vwap.price.toFixed(2)}`} tooltip="Current market price" theme="dark" />
            <MetricCard title="VWAP" value={`$${vwap.vwap.toFixed(2)}`} tooltip="Volume weighted average price" theme="dark" />
            <MetricCard title="Deviation" value={`${vwap.vwap_deviation_pct.toFixed(2)}%`} trend={Math.abs(vwap.vwap_deviation_pct) > 0.2 ? 'bearish' : 'neutral'} tooltip="Percentage deviation from VWAP" theme="dark" />
            <MetricCard title="Position" value={vwap.vwap_position} tooltip="Price position relative to VWAP" theme="dark" />
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Opening Range Breakout</h2>
        {orbError ? (
          <ErrorMessage message={orbError} />
        ) : !orb ? (
          <div className="bg-[#423d3f] rounded-lg p-6 text-center text-gray-400">
            No ORB data available (market may be closed)
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <MetricCard title="Current Price" value={`$${orb.current_price.toFixed(2)}`} tooltip="Current market price" theme="dark" />
              <MetricCard title="ORB High" value={`$${orb.orb_high.toFixed(2)}`} subtitle={`+${orb.distance_above_orb_high.toFixed(2)}`} tooltip="Opening range high" theme="dark" />
              <MetricCard title="ORB Low" value={`$${orb.orb_low.toFixed(2)}`} subtitle={`-${orb.distance_below_orb_low.toFixed(2)}`} tooltip="Opening range low" theme="dark" />
              <MetricCard title="ORB Range" value={`$${orb.orb_range.toFixed(2)}`} tooltip="Opening range size" theme="dark" />
            </div>
            <div className="bg-[#423d3f] rounded-lg p-6">
              <div className="text-xl font-semibold text-center">
                Status: <span className={`${orb.orb_status.includes('🚀') ? 'text-green-400' : orb.orb_status.includes('💥') ? 'text-red-400' : 'text-yellow-400'}`}>{orb.orb_status}</span>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Smart Money Flow</h2>
        <div className="bg-[#423d3f] rounded-lg p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <p className="text-sm text-gray-300">Unusual option flow from <code>/api/flow/smart-money</code>, aggregated by strike notional.</p>
            <label className="text-sm text-gray-300">
              Timeframe
              <select
                className="ml-2 rounded bg-[#2f2b2c] border border-gray-600 px-2 py-1"
                value={smartMoneyTimeframe}
                onChange={(e) => setSmartMoneyTimeframe(e.target.value)}
              >
                {['1min', '5min', '15min', '1hr', '1day'].map((tf) => (
                  <option key={tf} value={tf}>{tf}</option>
                ))}
              </select>
            </label>
          </div>

          {smartMoneyError ? <ErrorMessage message={smartMoneyError} /> : !smartMoneyData || smartMoneyData.length === 0 ? (
            <div className="text-gray-400 text-center py-6">No smart money flow data available</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={smartMoneyByStrike}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#968f92" opacity={0.25} />
                  <XAxis dataKey="strike" stroke="#f2f2f2" tickFormatter={(value) => `$${Number(value).toFixed(0)}`} />
                  <YAxis stroke="#f2f2f2" tickFormatter={(value) => `$${Number(value).toFixed(1)}M`} />
                  <Tooltip formatter={(value) => `$${Number(value ?? 0).toFixed(2)}M`} />
                  <Bar dataKey="totalNotional" name="Total Notional (M)">
                    {smartMoneyByStrike.map((row) => (
                      <Cell key={row.strike} fill={row.callNotional >= row.putNotional ? '#34d399' : '#f87171'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <div className="overflow-x-auto mt-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700 text-gray-300">
                      <th className="text-left py-2 px-2">Time</th>
                      <th className="text-left py-2 px-2">Contract</th>
                      <th className="text-right py-2 px-2">Strike</th>
                      <th className="text-left py-2 px-2">Expiry</th>
                      <th className="text-right py-2 px-2">DTE</th>
                      <th className="text-left py-2 px-2">Type</th>
                      <th className="text-right py-2 px-2">Flow</th>
                      <th className="text-right py-2 px-2">Notional</th>
                      <th className="text-left py-2 px-2">Class</th>
                    </tr>
                  </thead>
                  <tbody>
                    {smartMoneyData.map((row) => (
                      <tr key={`${row.timestamp}-${row.contract}`} className="border-b border-gray-800">
                        <td className="py-2 px-2">{new Date(row.timestamp).toLocaleTimeString()}</td>
                        <td className="py-2 px-2 font-mono text-xs">{row.contract}</td>
                        <td className="text-right py-2 px-2">${Number(row.strike).toFixed(2)}</td>
                        <td className="py-2 px-2">{row.expiration}</td>
                        <td className="text-right py-2 px-2">{row.dte}</td>
                        <td className={`py-2 px-2 ${row.option_type.toLowerCase().includes('call') ? 'text-green-300' : 'text-red-300'}`}>{row.option_type}</td>
                        <td className="text-right py-2 px-2">{Number(row.flow).toLocaleString()}</td>
                        <td className="text-right py-2 px-2">${(Number(row.notional) / 1000000).toFixed(2)}M</td>
                        <td className="py-2 px-2">{row.notional_class} / {row.size_class}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Unusual Volume Spikes</h2>
        {!volumeSpikes || volumeSpikes.length === 0 ? (
          <div className="bg-[#423d3f] rounded-lg p-6 text-center text-gray-400">
            No unusual volume detected
          </div>
        ) : (
          <div className="bg-[#423d3f] rounded-lg p-6">
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {volumeSpikes.map((spike, idx) => (
                <div key={idx} className="flex items-center justify-between border-b border-gray-800 pb-3">
                  <div>
                    <div className="font-semibold">{new Date(spike.time_et).toLocaleTimeString()}</div>
                    <div className="text-sm text-gray-400">Volume: {spike.current_volume.toLocaleString()} ({spike.volume_ratio.toFixed(1)}x avg)</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{spike.volume_sigma.toFixed(1)}σ</div>
                    <div className="text-sm">{spike.volume_class}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Momentum Divergence Signals</h2>
        {!divergenceMarketRows || divergenceMarketRows.length === 0 ? (
          <div className="bg-[#423d3f] rounded-lg p-6 text-center text-gray-400">No divergence signals</div>
        ) : (
          <div className="bg-[#423d3f] rounded-lg p-6">
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {divergenceMarketRows.map((signal, idx) => {
                const timestamp = signal.time_et || signal.timestamp || signal.time_window_end || signal.time || '';
                const divergenceSignal = signal.divergence_signal || signal.signal || signal.divergence_type || 'No signal';
                const price = Number(signal.price || 0);
                return (
                  <div key={idx} className="border-b border-gray-800 pb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold">{timestamp ? new Date(timestamp).toLocaleTimeString() : '--:--'}</div>
                      <div className={`px-3 py-1 rounded text-sm font-semibold ${
                        divergenceSignal.includes('🚨') ? 'bg-yellow-900 text-yellow-300' :
                        divergenceSignal.includes('🟢') ? 'bg-green-900 text-green-300' :
                        divergenceSignal.includes('🔴') ? 'bg-red-900 text-red-300' :
                        'bg-gray-800 text-gray-300'
                      }`}>
                        {divergenceSignal}
                      </div>
                    </div>
                    <div className="text-sm text-gray-400">Price: ${price.toFixed(2)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
