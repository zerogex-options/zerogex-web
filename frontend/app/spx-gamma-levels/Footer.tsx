'use client';

import { useTheme } from '@/core/ThemeContext';
import FooterBase from '@/components/Footer';

export default function Footer() {
  const { theme } = useTheme();
  return <FooterBase theme={theme} />;
}
