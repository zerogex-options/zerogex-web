'use client';

export default function AboutPage() {
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-6">About ZeroGEX</h1>
      
      <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        About ZeroGEX
      </h2>
      
      <div className="p-8 rounded-2xl space-y-6 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700">
        <div>
          <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-gray-100">
            Professional-Grade Options Flow Analytics
          </h3>
          <p className="leading-relaxed text-gray-700 dark:text-gray-300">
            ZeroGEX is a real-time options analytics platform that provides institutional-quality gamma exposure (GEX) analysis,
            options flow tracking, and dealer positioning insights for retail traders.
          </p>
        </div>
        
        <div>
          <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-gray-100">
            What We Track
          </h3>
          <ul className="space-y-2 text-gray-700 dark:text-gray-300">
            <li className="flex items-start gap-3">
              <span className="text-lg leading-none mt-0.5">•</span>
              <span>Real-time gamma exposure by strike level</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-lg leading-none mt-0.5">•</span>
              <span>Dealer hedging flow and market impact</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-lg leading-none mt-0.5">•</span>
              <span>Unusual options activity and smart money trades</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-lg leading-none mt-0.5">•</span>
              <span>Put/call ratios and directional sentiment</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-lg leading-none mt-0.5">•</span>
              <span>Intraday support/resistance from option positioning</span>
            </li>
          </ul>
        </div>
        
        <div>
          <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-gray-100">
            How It Works
          </h3>
          <p className="leading-relaxed text-gray-700 dark:text-gray-300">
            Our platform ingests live options data from TradeStation, calculates Greeks using Black-Scholes models,
            and aggregates dealer positioning to identify key price levels where market makers will be forced to hedge.
            This creates predictable support and resistance zones that day traders can exploit.
          </p>
        </div>
        
        <div>
          <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-gray-100">
            Technology
          </h3>
          <p className="leading-relaxed text-gray-700 dark:text-gray-300">
            Built with Python, PostgreSQL, TimescaleDB, and AWS infrastructure for institutional-grade performance and reliability.
            Data updates every second during market hours.
          </p>
        </div>
      </div>
    </div>
  );
}
