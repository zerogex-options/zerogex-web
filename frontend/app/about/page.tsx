"use client";

import { useTheme } from "@/core/ThemeContext";
import { colors } from "@/core/colors";
import ExpandableCard from "@/components/ExpandableCard";

export default function AboutPage() {
  const { theme } = useTheme();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-6">About ZeroGEX</h1>

      <h2
        className="text-3xl font-bold mb-6"
        style={{ color: theme === "dark" ? colors.light : colors.dark }}
      >
        About ZeroGEX
      </h2>

      <ExpandableCard>
        <div
          className="p-8 rounded-2xl space-y-6"
          style={{
            backgroundColor:
              theme === "dark" ? colors.cardDark : colors.cardLight,
            border: `1px solid ${colors.muted}`,
          }}
        >
          <div>
            <h3
              className="text-xl font-bold mb-3"
              style={{ color: theme === "dark" ? colors.light : colors.dark }}
            >
              Professional-Grade Options Flow Analytics
            </h3>
            <p
              className="leading-relaxed"
              style={{
                color: theme === "dark" ? colors.light : colors.dark,
                opacity: 0.8,
              }}
            >
              ZeroGEX is a real-time options analytics platform that provides
              institutional-quality gamma exposure (GEX) analysis, options flow
              tracking, and dealer positioning insights for retail traders.
            </p>
          </div>

          <div>
            <h3
              className="text-xl font-bold mb-3"
              style={{ color: theme === "dark" ? colors.light : colors.dark }}
            >
              API Documentation
            </h3>
            <ul
              className="space-y-2"
              style={{
                color: theme === "dark" ? colors.light : colors.dark,
                opacity: 0.9,
              }}
            >
              <li>
                •{" "}
                <a
                  className="underline"
                  href="https://api.zerogex.io/docs"
                  target="_blank"
                  rel="noreferrer"
                >
                  OpenAPI Swagger UI
                </a>
              </li>
              <li>
                •{" "}
                <a
                  className="underline"
                  href="https://api.zerogex.io/redoc"
                  target="_blank"
                  rel="noreferrer"
                >
                  ReDoc
                </a>
              </li>
              <li>
                •{" "}
                <a
                  className="underline"
                  href="https://api.zerogex.io/openapi.json"
                  target="_blank"
                  rel="noreferrer"
                >
                  OpenAPI JSON Schema
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3
              className="text-xl font-bold mb-3"
              style={{ color: theme === "dark" ? colors.light : colors.dark }}
            >
              What We Track
            </h3>
            <ul
              className="space-y-2"
              style={{
                color: theme === "dark" ? colors.light : colors.dark,
                opacity: 0.8,
              }}
            >
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
        </div>
      </ExpandableCard>
    </div>
  );
}
