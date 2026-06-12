import RealTimeGexLandingClient from './Client';
import { articleMetadata } from '@/core/articleRegistry';

export const metadata = articleMetadata('real-time-gex-0dte');

export default function RealTimeGex0DTEPage() {
  return <RealTimeGexLandingClient />;
}
