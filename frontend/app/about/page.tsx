import { existsSync } from 'node:fs';
import path from 'node:path';
import AboutClient from './Client';

export const metadata = {
  title: 'About ZeroGEX: The Open Options Analytics Platform',
  description:
    'About ZeroGEX - what we build, how the platform works, and why an open, real-time gamma-exposure and options-flow stack matters for retail and pro traders.',
  alternates: { canonical: '/about' },
};

// Michael's photo on the founder card. Commit one of these to
// frontend/public/ and it appears after the next deploy; until then the card
// renders without one instead of as a broken image. Next only serves files
// that were in public/ when the server started, so the photo has to ship with
// a deploy rather than be copied onto a running server.
const FOUNDER_PHOTO = ['founder.jpg', 'founder.jpeg', 'founder.png', 'founder.webp']
  .find((name) => existsSync(path.join(process.cwd(), 'public', name)));

export default function AboutPage() {
  return <AboutClient founderPhoto={FOUNDER_PHOTO ? `/${FOUNDER_PHOTO}` : null} />;
}
