import GivingClient from './Client';

export const metadata = {
  title: 'Giving Back — ZeroGEX Supports Folds of Honor',
  description:
    'ZeroGEX donates 3% of every subscription to Folds of Honor, providing educational scholarships to the families of fallen and disabled U.S. service members.',
  alternates: { canonical: '/giving' },
};

export default function GivingPage() {
  return <GivingClient />;
}
