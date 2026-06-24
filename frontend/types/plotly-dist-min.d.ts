// plotly.js-dist-min ships no bundled types. We only touch a tiny, stable
// slice of the imperative API (react / purge / Plots.resize) from a single
// client-only component, so a minimal ambient declaration is sufficient and
// avoids pulling in the heavy @types/plotly.js dependency.
declare module 'plotly.js-dist-min' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type PlotlyData = Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type PlotlyLayout = Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type PlotlyConfig = Record<string, any>;

  const Plotly: {
    react(
      el: HTMLElement,
      data: PlotlyData[],
      layout?: PlotlyLayout,
      config?: PlotlyConfig,
    ): Promise<void>;
    newPlot(
      el: HTMLElement,
      data: PlotlyData[],
      layout?: PlotlyLayout,
      config?: PlotlyConfig,
    ): Promise<void>;
    purge(el: HTMLElement): void;
    Plots: { resize(el: HTMLElement): void };
  };
  export default Plotly;
}
