import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Social Greetings',
  description: 'Kind words, playful themes, and a wall that keeps the good vibes rolling.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
