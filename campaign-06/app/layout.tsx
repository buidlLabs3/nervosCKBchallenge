import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fiber Workshop',
  description: 'Connect a browser node and send a real CKB Testnet payment.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
