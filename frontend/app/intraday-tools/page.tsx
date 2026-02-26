/**
 * Intraday Trading Tools Page
 * VWAP, ORB, Volume Spikes, Momentum Divergence, etc.
 */

'use client';

import { useApiData } from '@/hooks/useApiData';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import MetricCard from '@/components/MetricCard';

export default function IntradayToolsPage() {
  const { data: vwapData, loading: vwapLoading, error: vwapError } = useApiData<any[]>(
    '/api/trading/vwap-deviation?limit=1',
    { refreshInterval: 5000 }
  );

  const { data: orbData, loading: orbLoading, error: orbError } = useApiData<any[]>(
    '/api/trading/opening-range?limit=1',
    { refreshInterval: 5000 }
  );

  const { data: gammaLevels } = useApiData<any[]>(
    '/api/trading/gamma-levels?limit=10',
    { refreshInterval: 30000 }
  );

  const { data: volumeSpikes } = useApiData<any[]>(
    '/api/trading/volume-spikes?limit=5',
    { refreshInterval: 10000 }
  );

  const { data: divergence } = useApiData<any[]>(
    '/api/trading/momentum-divergence?limit=5',
    { refreshInterval: 5000 }
  );

  const vwap = vwapData?.[0];
  const orb = orbData?.[0];

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
        {!divergence || divergence.length === 0 ? (
          <div className="bg-[#423d3f] rounded-lg p-6 text-center text-gray-400">
            No divergence signals
          </div>
        ) : (
          <div className="bg-[#423d3f] rounded-lg p-6">
            <div className="space-y-3">
              {divergence.map((signal, idx) => (
                <div key={idx} className="border-b border-gray-800 pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold">{new Date(signal.time_et).toLocaleTimeString()}</div>
                    <div className={`px-3 py-1 rounded text-sm font-semibold ${
                      signal.divergence_signal.includes('🚨') ? 'bg-yellow-900 text-yellow-300' :
                      signal.divergence_signal.includes('🟢') ? 'bg-green-900 text-green-300' :
                      signal.divergence_signal.includes('🔴') ? 'bg-red-900 text-red-300' :
                      'bg-gray-800 text-gray-300'
                    }`}>
                      {signal.divergence_signal}
                    </div>
                  </div>
                  <div className="text-sm text-gray-400">
                    Price: ${signal.price.toFixed(2)} | 
                    5min Change: ${signal.price_change_5min.toFixed(2)} |
                    Net Volume: {signal.net_volume.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
