import AboutClient from './Client';

export const metadata = {
  title: 'About ZeroGEX: The Open Options Analytics Platform',
  description:
    'About ZeroGEX — what we build, how the platform works, and why an open, real-time gamma-exposure and options-flow stack matters for retail and pro traders.',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return <AboutClient />;
}
