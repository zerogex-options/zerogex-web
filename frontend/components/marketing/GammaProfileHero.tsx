'use client';

import { useEffect, useRef } from 'react';
import { useGEXProfile } from '@/hooks/useApiData';
import RegistrationCorners from './RegistrationCorners';

/**
 * The landing hero visual IS the product output: the live net-GEX-by-price
 * curve, drawn as a terminal readout. Positive gamma fills in --color-bull,
 * negative in --color-bear, the zero-gamma / flip is banded in --heat-mid (the
 * theme's flip color), and spot is the single --color-accent-hot cursor.
 *
 * All colors are read from the active theme's CSS variables, so the hero
 * re-themes with the palette. Graceful empty state before data arrives.
 */
function fmtUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '+';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(0)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export default function GammaProfileHero({ symbol = 'SPY' }: { symbol?: string }) {
  const { data } = useGEXProfile(symbol, 30000);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const profile = Array.isArray(data?.profile) ? data!.profile.filter((p) => Number.isFinite(p?.price) && Number.isFinite(p?.gex)) : [];
  const flip = data?.gamma_flip ?? null;
  const callWall = data?.call_wall ?? null;
  const putWall = data?.put_wall ?? null;
  const spot = data?.spot_price ?? null;
  const netGex = data?.net_gex_at_spot ?? null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const css = getComputedStyle(document.documentElement);
    const c = {
      ink: css.getPropertyValue('--text-primary').trim() || '#eee',
      grid: css.getPropertyValue('--color-grid-line').trim() || 'rgba(255,255,255,0.1)',
      bull: css.getPropertyValue('--color-bull').trim() || '#22c55e',
      bear: css.getPropertyValue('--color-bear').trim() || '#ef4444',
      flip: css.getPropertyValue('--heat-mid').trim() || '#f59e0b',
      spot: css.getPropertyValue('--color-accent-hot').trim() || '#f43f5e',
      rule: css.getPropertyValue('--border-default').trim() || 'rgba(255,255,255,0.2)',
    };

    let raf = 0;
    const pad = { l: 12, r: 12, t: 20, b: 20 };

    function withAlpha(hex: string, a: number): string {
      const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
      if (!m) return hex;
      const n = parseInt(m[1], 16);
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    }

    function draw(progress: number) {
      const cv = canvasRef.current;
      if (!cv || !ctx) return;
      const rect = cv.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = W * dpr;
      cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // faceplate grid
      ctx.strokeStyle = c.grid;
      ctx.lineWidth = 1;
      [0.28, 0.52, 0.76].forEach((f) => {
        const y = pad.t + (H - pad.t - pad.b) * f;
        ctx.beginPath();
        ctx.moveTo(pad.l, y);
        ctx.lineTo(W - pad.r, y);
        ctx.stroke();
      });

      if (profile.length < 2) {
        ctx.fillStyle = c.rule;
        ctx.font = '11px ui-monospace, Menlo, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('AWAITING LIVE GEX SNAPSHOT', W / 2, H / 2);
        return;
      }

      const prices = profile.map((p) => p.price);
      const minP = Math.min(...prices);
      const maxP = Math.max(...prices);
      const maxG = Math.max(...profile.map((p) => Math.abs(p.gex))) * 1.12 || 1;
      const X = (price: number) => pad.l + ((price - minP) / (maxP - minP || 1)) * (W - pad.l - pad.r);
      const midY = pad.t + (H - pad.t - pad.b) * 0.52;
      const Y = (g: number) => midY - (g / maxG) * ((H - pad.t - pad.b) * 0.44);
      const zeroY = Y(0);
      const cut = Math.max(1, Math.floor(profile.length * progress));

      // flip band
      if (flip != null) {
        const fx = X(flip);
        ctx.fillStyle = withAlpha(c.flip, 0.13);
        ctx.fillRect(fx - 13, pad.t - 4, 26, H - pad.t - pad.b + 8);
      }

      // signed areas
      const area = (sign: number) => {
        ctx.beginPath();
        ctx.moveTo(X(profile[0].price), zeroY);
        for (let i = 0; i < cut; i++) {
          const p = profile[i];
          const v = sign > 0 ? Math.max(p.gex, 0) : Math.min(p.gex, 0);
          ctx.lineTo(X(p.price), Y(v));
        }
        ctx.lineTo(X(profile[cut - 1].price), zeroY);
        ctx.closePath();
        ctx.fillStyle = withAlpha(sign > 0 ? c.bull : c.bear, 0.16);
        ctx.fill();
      };
      area(1);
      area(-1);

      // zero baseline
      ctx.strokeStyle = c.rule;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.l, zeroY);
      ctx.lineTo(W - pad.r, zeroY);
      ctx.stroke();

      // curve
      ctx.beginPath();
      for (let i = 0; i < cut; i++) {
        const p = profile[i];
        if (i === 0) ctx.moveTo(X(p.price), Y(p.gex));
        else ctx.lineTo(X(p.price), Y(p.gex));
      }
      ctx.strokeStyle = c.ink;
      ctx.lineWidth = 1.75;
      ctx.lineJoin = 'round';
      ctx.stroke();

      const done = progress >= 0.999;
      const tick = (price: number | null, color: string, label: string, top: boolean) => {
        if (price == null || price < minP || price > maxP) return;
        const x = X(price);
        ctx.strokeStyle = withAlpha(color, 0.55);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, pad.t - 4);
        ctx.lineTo(x, H - pad.b + 4);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = '9px ui-monospace, Menlo, monospace';
        ctx.textAlign = x > W * 0.72 ? 'end' : 'start';
        ctx.fillText(label, x > W * 0.72 ? x - 5 : x + 5, top ? pad.t + 8 : H - pad.b - 4);
      };

      if (flip != null) {
        tick(flip, c.flip, 'FLIP', true);
        // Registration crosshair at the exact zero-gamma crossing — the flip
        // marked where dealer gamma changes sign.
        const fx = X(flip);
        ctx.strokeStyle = c.flip;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(fx - 15, zeroY); ctx.lineTo(fx + 15, zeroY);
        ctx.moveTo(fx, zeroY - 15); ctx.lineTo(fx, zeroY + 15);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(fx, zeroY, 4.5, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (done) {
        tick(callWall, c.bull, 'CALL WALL', false);
        tick(putWall, c.bear, 'PUT WALL', false);
        if (spot != null && spot >= minP && spot <= maxP) {
          const sx = X(spot);
          // find nearest curve point for the cursor dot
          let near = profile[0];
          for (const p of profile) if (Math.abs(p.price - spot) < Math.abs(near.price - spot)) near = p;
          const sy = Y(near.gex);
          ctx.strokeStyle = withAlpha(c.spot, 0.35);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(sx, pad.t);
          ctx.lineTo(sx, H - pad.b);
          ctx.stroke();
          ctx.fillStyle = c.spot;
          ctx.beginPath();
          ctx.arc(sx, sy, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.textAlign = sx > W * 0.72 ? 'end' : 'start';
          ctx.font = '9px ui-monospace, Menlo, monospace';
          ctx.fillText('SPOT', sx > W * 0.72 ? sx - 8 : sx + 8, sy - 9);
        }
      }
    }

    let start: number | null = null;
    const DUR = 1100;
    function frame(tms: number) {
      if (start === null) start = tms;
      const prog = reduce ? 1 : Math.min((tms - start) / DUR, 1);
      draw(1 - Math.pow(1 - prog, 3));
      if (prog < 1) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    const onResize = () => draw(1);
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.length, flip, callWall, putWall, spot]);

  return (
    <div className="zg-panel" style={{ overflow: 'hidden', position: 'relative' }}>
      <RegistrationCorners />
      <div
        className="flex items-center justify-between"
        style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-default)' }}
      >
        <span className="zg-eyebrow" style={{ color: 'var(--text-primary)' }}>{symbol} · NET GEX BY PRICE</span>
        <span className="zg-eyebrow" style={{ color: 'var(--text-secondary)' }}>LIVE PROFILE</span>
      </div>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: 260 }} aria-label={`${symbol} net gamma exposure by price, crossing zero at the gamma flip`} />
      <div
        className="flex flex-wrap"
        style={{ borderTop: '1px solid var(--border-default)' }}
      >
        {[
          { l: 'Net GEX', v: fmtUsd(netGex), c: netGex == null ? 'var(--text-primary)' : netGex >= 0 ? 'var(--color-bull)' : 'var(--color-bear)' },
          { l: 'Flip', v: flip != null ? `$${flip.toFixed(0)}` : '--', c: 'var(--heat-mid)' },
          { l: 'Call Wall', v: callWall != null ? `$${callWall.toFixed(0)}` : '--', c: 'var(--color-bull)' },
          { l: 'Put Wall', v: putWall != null ? `$${putWall.toFixed(0)}` : '--', c: 'var(--color-bear)' },
        ].map((cell, i) => (
          <div
            key={cell.l}
            className="flex-1"
            style={{ padding: '10px 16px', borderLeft: i === 0 ? undefined : '1px solid var(--border-default)', minWidth: 100 }}
          >
            <div className="zg-eyebrow" style={{ color: 'var(--text-secondary)' }}>{cell.l}</div>
            <div className="zg-metric" style={{ fontSize: 18, marginTop: 4, color: cell.c }}>{cell.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
