'use client';

/**
 * Reusable empty-state card for the TradeWorkz surfaces.
 *
 * Used across the leaderboard, roster, and drilldown so an empty period
 * feels intentional rather than broken. Includes a "seed demo data" call
 * to action when the admin can trigger the simulate endpoint.
 */

import { ReactNode } from 'react';

interface Props {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export default function EmptyState({ title, description, action, icon }: Props) {
  return (
    <div
      className="p-8 rounded-2xl text-center"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px dashed var(--color-border)',
      }}
    >
      {icon ? (
        <div className="mx-auto mb-3 flex items-center justify-center w-10 h-10 rounded-full"
             style={{ backgroundColor: 'var(--color-info-soft)', color: 'var(--color-info)' }}>
          {icon}
        </div>
      ) : null}
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">{title}</h3>
      <p className="text-xs text-[var(--color-text-secondary)] max-w-md mx-auto">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
