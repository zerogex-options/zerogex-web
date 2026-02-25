'use client';

import { useState, useEffect, useRef } from 'react';
import { Info } from 'lucide-react';
import { colors } from '@/lib/colors';

interface TooltipWrapperProps {
  text: string;
  children?: React.ReactNode;
}

export default function TooltipWrapper({ text, children }: TooltipWrapperProps) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (show && buttonRef.current && tooltipRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      
      setPosition({
        top: rect.bottom + window.scrollY + 10,
        left: Math.max(10, rect.left + window.scrollX - tooltipRect.width / 2 + rect.width / 2),
      });
    }
  }, [show]);

  return (
    <>
      <button
        ref={buttonRef}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="inline-flex items-center opacity-60 hover:opacity-100 transition-opacity duration-200"
        style={{ cursor: 'help' }}
      >
        {children || <Info size={14} />}
      </button>
      {show && (
        <div
          ref={tooltipRef}
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            zIndex: 999999,
            width: '300px',
            backgroundColor: colors.cardDark,
            color: colors.light,
            border: `1px solid ${colors.muted}`,
            borderRadius: '8px',
            padding: '12px',
            fontSize: '12px',
            lineHeight: '1.5',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            pointerEvents: 'none',
          }}
        >
          {text}
        </div>
      )}
    </>
  );
}
