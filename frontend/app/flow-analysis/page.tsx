/**
 * Options Flow Analysis Page
 * Real-time options flow tracking and smart money detection
 */

'use client';

import { useOptionFlow, useSmartMoneyFlow, useApiData } from '@/hooks/useApiData';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import MetricCard from '@/components/MetricCard';

export default function FlowAnalysisPage() {
  const { data: flowData, loading: flowLoading, error: flowError } = useOptionFlow(60, 5000);
  const { data: smartMoney, loading: smartLoading, error: smartError } = useSmartMoneyFlow(10, 10000);
  const { data: flowByStrike } = useApiData<any[]>('/api/flow/by-strike?limit=10', { refreshInterval: 5000 });

  if (flowLoading && !flowData) {
    return <LoadingSpinner size="lg" />;
  }

  // Calculate totals from flow data
  const callFlow = flowData?.find(f => f.option_type === 'CALL');
  const putFlow = flowData?.find(f => f.option_type === 'PUT');

  const totalCallVolume = callFlow?.total_volume || 0;
  const totalPutVolume = putFlow?.total_volume || 0;
  const totalCallPremium = callFlow?.total_premium || 0;
  const totalPutPremium = putFlow?.total_premium || 0;

  const netFlow = totalCallVolume - totalPutVolume;
  const netPremium = totalCallPremium - totalPutPremium;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Options Flow Analysis</h1>

      {/* Error Messages */}
      {flowError && <ErrorMessage message={flowError} />}

      {/* Flow Summary */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Flow Summary (Last Hour)</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard
            label="Call Volume"
            value={totalCallVolume.toLocaleString()}
            subtitle={`$${(totalCallPremium / 1000000).toFixed(2)}M premium`}
            sentiment="bullish"
          />
          <MetricCard
            label="Put Volume"
            value={totalPutVolume.toLocaleString()}
            subtitle={`$${(totalPutPremium / 1000000).toFixed(2)}M premium`}
            sentiment="bearish"
          />
          <MetricCard
            label="Net Flow"
            value={netFlow.toLocaleString()}
            sentiment={netFlow > 0 ? 'bullish' : 'bearish'}
          />
          <MetricCard
            label="Net Premium"
            value={`$${(netPremium / 1000000).toFixed(2)}M`}
            sentiment={netPremium > 0 ? 'bullish' : 'bearish'}
          />
        </div>
      </section>

      {/* Smart Money Flow */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Smart Money / Unusual Activity</h2>
        {smartError ? (
          <ErrorMessage message={smartError} />
        ) : smartLoading ? (
          <LoadingSpinner />
        ) : !smartMoney || smartMoney.length === 0 ? (
          <div className="bg-[#423d3f] rounded-lg p-6 text-center text-gray-400">
            No unusual activity detected in the last hour
          </div>
        ) : (
          <div className="bg-[#423d3f] rounded-lg p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4">Time</th>
                    <th className="text-center py-3 px-4">Type</th>
                    <th className="text-right py-3 px-4">Strike</th>
                    <th className="text-right py-3 px-4">Volume</th>
                    <th className="text-right py-3 px-4">Premium</th>
                    <th className="text-center py-3 px-4">Size</th>
                    <th className="text-center py-3 px-4">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {smartMoney.map((trade, idx) => (
                    <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="py-2 px-4 text-sm">
                        {new Date(trade.time_window_end).toLocaleTimeString()}
                      </td>
                      <td className="text-center py-2 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          trade.option_type === 'C' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                        }`}>
                          {trade.option_type === 'C' ? 'CALL' : 'PUT'}
                        </span>
                      </td>
                      <td className="text-right py-2 px-4 font-mono">
                        ${trade.strike.toFixed(2)}
                      </td>
                      <td className="text-right py-2 px-4">
                        {trade.total_volume.toLocaleString()}
                      </td>
                      <td className="text-right py-2 px-4">
                        ${(trade.total_premium / 1000).toFixed(1)}K
                      </td>
                      <td className="text-center py-2 px-4 text-xs">
                        {trade.size_class}
                      </td>
                      <td className="text-center py-2 px-4">
                        <span className="px-2 py-1 rounded bg-blue-900 text-blue-300 font-semibold">
                          {trade.unusual_activity_score}/10
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Flow by Strike */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Flow by Strike (Top 10)</h2>
        {!flowByStrike || flowByStrike.length === 0 ? (
          <div className="bg-[#423d3f] rounded-lg p-6 text-center text-gray-400">
            No flow data available
          </div>
        ) : (
          <div className="bg-[#423d3f] rounded-lg p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-right py-3 px-4">Strike</th>
                    <th className="text-right py-3 px-4">Total Volume</th>
                    <th className="text-right py-3 px-4">Total Premium</th>
                    <th className="text-right py-3 px-4">Avg IV</th>
                  </tr>
                </thead>
                <tbody>
                  {flowByStrike.map((row, idx) => (
                    <tr key={idx} className="border-b border-gray-800">
                      <td className="text-right py-2 px-4 font-mono">
                        ${row.strike.toFixed(2)}
                      </td>
                      <td className="text-right py-2 px-4">
                        {row.total_volume.toLocaleString()}
                      </td>
                      <td className="text-right py-2 px-4">
                        ${(row.total_premium / 1000000).toFixed(2)}M
                      </td>
                      <td className="text-right py-2 px-4">
                        {row.avg_iv ? (row.avg_iv * 100).toFixed(1) + '%' : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Data Timestamp */}
      {flowData && flowData.length > 0 && (
        <div className="text-right text-sm text-gray-500">
          Last updated: {new Date(flowData[0].time_window_end).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
