/**
 * Intraday Trading Tools Page
 * VWAP, ORB, Volume Spikes, Momentum Divergence, etc.
 */

'use client';

import { useApiData } from '@/hooks/useApiData';
import { Info } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import MetricCard from '@/components/MetricCard';
import TooltipWrapper from '@/components/TooltipWrapper';
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

interface GammaLevelRow {
  strike: number;
  net_gex: number;
  gex_level: string;
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
  time_window_end?: string;
  divergence_signal?: string;
  signal?: string;
  price?: number;
  price_change_5min?: number;
  net_volume?: number;
}

export default function IntradayToolsPage() {
  const { symbol, timeframe } = useTimeframe();
  const { data: vwapData, loading: vwapLoading, error: vwapError } = useApiData<VwapDeviationRow[]>(
    `/api/trading/vwap-deviation?symbol=${symbol}&timeframe=${timeframe}&window_units=20`,
    { refreshInterval: 5000 }
  );

  const { data: orbData, loading: orbLoading, error: orbError } = useApiData<OpeningRangeRow[]>(
    `/api/trading/opening-range?symbol=${symbol}&timeframe=${timeframe}&window_units=20`,
    { refreshInterval: 5000 }
  );

  const { data: gammaLevels } = useApiData<GammaLevelRow[]>(
    `/api/trading/gamma-levels?symbol=${symbol}&limit=10`,
    { refreshInterval: 30000 }
  );

  const { data: volumeSpikes } = useApiData<VolumeSpikeRow[]>(
    `/api/trading/volume-spikes?symbol=${symbol}&limit=5`,
    { refreshInterval: 10000 }
  );

  const { data: divergenceResponse } = useApiData<DivergenceRow[] | { data?: DivergenceRow[]; results?: DivergenceRow[]; signals?: DivergenceRow[] }>(
    `/api/trading/momentum-divergence?symbol=${symbol}&timeframe=${timeframe}&window_units=20`,
    { refreshInterval: 5000 }
  );

  const divergence = Array.isArray(divergenceResponse)
    ? divergenceResponse
    : divergenceResponse?.data || divergenceResponse?.results || divergenceResponse?.signals || [];

  const vwap = vwapData?.[0];
  const orb = orbData?.[0];
  const divergenceChart = omitClosedMarketTimes((divergence || []).slice().reverse().map((signal) => {
    const timestamp = signal.time_et || signal.timestamp || signal.time_window_end || '';
    return {
      time: timestamp
        ? new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
        : '--:--',
      priceChange: Number(signal.price_change_5min || 0),
      netVolumeK: Number(signal.net_volume || 0) / 1000,
      timestamp,
    };
  }), (row) => row.timestamp);


  if ((vwapLoading || orbLoading) && !vwapData && !orbData) {
    return <LoadingSpinner size="lg" />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Intraday Trading Tools</h1>

      {/* VWAP Section */}
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
            <MetricCard
              title="Current Price"
              value={`$${vwap.price.toFixed(2)}`}
              tooltip="Current market price"
              theme="dark"
            />
            <MetricCard
              title="VWAP"
              value={`$${vwap.vwap.toFixed(2)}`}
              tooltip="Volume weighted average price"
              theme="dark"
            />
            <MetricCard
              title="Deviation"
              value={`${vwap.vwap_deviation_pct.toFixed(2)}%`}
              trend={Math.abs(vwap.vwap_deviation_pct) > 0.2 ? 'bearish' : 'neutral'}
              tooltip="Percentage deviation from VWAP"
              theme="dark"
            />
            <MetricCard
              title="Position"
              value={vwap.vwap_position}
              tooltip="Price position relative to VWAP"
              theme="dark"
            />
          </div>
        )}
      </section>

      {/* Opening Range Breakout */}
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
              <MetricCard
                title="Current Price"
                value={`$${orb.current_price.toFixed(2)}`}
                tooltip="Current market price"
                theme="dark"
              />
              <MetricCard
                title="ORB High"
                value={`$${orb.orb_high.toFixed(2)}`}
                subtitle={`+${orb.distance_above_orb_high.toFixed(2)}`}
                tooltip="Opening range high"
                theme="dark"
              />
              <MetricCard
                title="ORB Low"
                value={`$${orb.orb_low.toFixed(2)}`}
                subtitle={`-${orb.distance_below_orb_low.toFixed(2)}`}
                tooltip="Opening range low"
                theme="dark"
              />
              <MetricCard
                title="ORB Range"
                value={`$${orb.orb_range.toFixed(2)}`}
                tooltip="Opening range size"
                theme="dark"
              />
            </div>
            <div className="bg-[#423d3f] rounded-lg p-6">
              <div className="text-xl font-semibold text-center">
                Status: <span className={`${
                  orb.orb_status.includes('🚀') ? 'text-green-400' :
                  orb.orb_status.includes('💥') ? 'text-red-400' :
                  'text-yellow-400'
                }`}>{orb.orb_status}</span>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Gamma Support/Resistance Levels */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Gamma Exposure Levels</h2>
        {!gammaLevels || gammaLevels.length === 0 ? (
          <div className="bg-[#423d3f] rounded-lg p-6 text-center text-gray-400">
            No gamma levels available
          </div>
        ) : (
          <div className="bg-[#423d3f] rounded-lg p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-right py-3 px-4">Strike</th>
                    <th className="text-right py-3 px-4">Net GEX</th>
                    <th className="text-left py-3 px-4">Level Type</th>
                  </tr>
                </thead>
                <tbody>
                  {gammaLevels.slice(0, 10).map((level, idx) => (
                    <tr key={idx} className="border-b border-gray-800">
                      <td className="text-right py-2 px-4 font-mono">
                        ${level.strike.toFixed(2)}
                      </td>
                      <td className={`text-right py-2 px-4 ${
                        level.net_gex > 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        ${(level.net_gex / 1000000).toFixed(2)}M
                      </td>
                      <td className="text-left py-2 px-4 text-sm">
                        {level.gex_level}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Volume Spikes */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Unusual Volume Spikes</h2>
        {!volumeSpikes || volumeSpikes.length === 0 ? (
          <div className="bg-[#423d3f] rounded-lg p-6 text-center text-gray-400">
            No unusual volume detected
          </div>
        ) : (
          <div className="bg-[#423d3f] rounded-lg p-6">
            <div className="space-y-3">
              {volumeSpikes.map((spike, idx) => (
                <div key={idx} className="flex items-center justify-between border-b border-gray-800 pb-3">
                  <div>
                    <div className="font-semibold">{new Date(spike.time_et).toLocaleTimeString()}</div>
                    <div className="text-sm text-gray-400">
                      Volume: {spike.current_volume.toLocaleString()} ({spike.volume_ratio.toFixed(1)}x avg)
                    </div>
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

      {/* Momentum Divergence */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Momentum Divergence Signals</h2>
        {divergenceChart.length > 0 && (
          <div className="bg-[#423d3f] rounded-lg p-6 mb-4">
            <div className="flex items-center gap-2 mb-3"><h3 className="text-lg font-semibold">Momentum Divergence Trend</h3><TooltipWrapper text="This chart plots short-horizon price change vs net directional volume from /api/trading/momentum-divergence. Price change is computed over 5 minutes; net volume is buy-minus-sell style flow. Persistent divergence between the two can signal weakening momentum or reversal risk."><Info size={14} /></TooltipWrapper></div>
            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={divergenceChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#968f92" opacity={0.3} />
                <XAxis dataKey="time" stroke="#f2f2f2" />
                <YAxis yAxisId="left" stroke="#f2f2f2" />
                <YAxis yAxisId="right" orientation="right" stroke="#f2f2f2" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" dataKey="priceChange" name="5m Price Change ($)" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line yAxisId="right" dataKey="netVolumeK" name="Net Volume (K)" stroke="#60a5fa" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
        {!divergence || divergence.length === 0 ? (
          <div className="bg-[#423d3f] rounded-lg p-6 text-center text-gray-400">
            No divergence signals
          </div>
        ) : (
          <div className="bg-[#423d3f] rounded-lg p-6">
            <div className="space-y-3">
              {divergence.map((signal, idx) => {
                const timestamp = signal.time_et || signal.timestamp || signal.time_window_end || '';
                const divergenceSignal = signal.divergence_signal || signal.signal || 'No signal';
                const price = Number(signal.price || 0);
                const priceChange = Number(signal.price_change_5min || 0);
                const netVolume = Number(signal.net_volume || 0);
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
                    <div className="text-sm text-gray-400">
                      Price: ${price.toFixed(2)} | 
                      5min Change: ${priceChange.toFixed(2)} |
                      Net Volume: {netVolume.toLocaleString()}
                    </div>
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
