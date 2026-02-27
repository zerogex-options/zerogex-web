'use client';

import { useState, useEffect, useRef } from 'react';
import { Info } from 'lucide-react';
import { colors } from '@/core/colors';

interface TooltipWrapperProps {
  text: string;
  children?: React.ReactNode;
}

export default function TooltipWrapper({ text, children }: TooltipWrapperProps) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState<'left' | 'right' | 'center'>('center');
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (show && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const windowWidth = window.innerWidth;
      
      // Determine best position based on button location
      if (rect.left < windowWidth / 3) {
        // Button on left side - tooltip opens to the right
        setPosition('right');
      } else if (rect.right > (windowWidth * 2) / 3) {
        // Button on right side - tooltip opens to the left
        setPosition('left');
      } else {
        // Button in center - tooltip centered
        setPosition('center');
      }
    }
  }, [show]);

  const getTooltipStyle = () => {
    const baseStyle = {
      position: 'absolute' as const,
      top: '100%',
      marginTop: '8px',
      zIndex: 99999,
      width: '280px',
      backgroundColor: colors.cardDark,
      color: colors.light,
      border: `1px solid ${colors.muted}`,
      borderRadius: '8px',
      padding: '12px',
      fontSize: '13px',
      lineHeight: '1.5',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      pointerEvents: 'none' as const,
    };

    if (position === 'left') {
      return { ...baseStyle, right: 0 };
    } else if (position === 'right') {
      return { ...baseStyle, left: 0 };
    } else {
      return { ...baseStyle, left: '50%', transform: 'translateX(-50%)' };
    }
  };

  return (
    <div ref={buttonRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="inline-flex items-center opacity-60 hover:opacity-100 transition-opacity duration-200"
        style={{ 
          cursor: 'help',
          background: 'none',
          border: 'none',
          padding: 0
        }}
        type="button"
      >
        {children || <Info size={14} />}
      </button>
      {show && (
        <div style={getTooltipStyle()}>
          {text}
        </div>
      )}
    </div>
  );
}
