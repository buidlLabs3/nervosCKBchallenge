import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pay to Unlock · Fiber',
  description: 'Encrypt a result, sell it for one CKB, and decrypt it with the Fiber payment preimage.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
