import LandingClient from './LandingClient';

export const metadata = {
  alternates: { canonical: '/' },
};

export default function HomePage() {
  return <LandingClient />;
}
