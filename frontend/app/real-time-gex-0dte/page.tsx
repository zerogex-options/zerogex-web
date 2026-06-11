import RealTimeGexLandingClient from './Client';

export const metadata = {
  title: 'Real-Time GEX for 0DTE Traders | ZeroGEX',
  description:
    'Real-time GEX for 0DTE traders. Live gamma flip, call and put walls, dealer positioning, and composite signals built for SPX/0DTE intraday flow. Free dashboard.',
};

export default function RealTimeGex0DTEPage() {
  return <RealTimeGexLandingClient />;
}
