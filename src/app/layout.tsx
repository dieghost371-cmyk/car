import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
export const metadata: Metadata = {
  title: 'APEX — Real cars. Raw adrenaline.',
  description: 'Your favorite machines. Your closest rivals. Race solo or create a private three-player room with friends, on PC and mobile. No downloads. Just drive.',
  applicationName: 'APEX Motorsport',
  icons: { icon: '/icon.svg' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#111214', viewportFit: 'cover' };
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><head><link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" /><link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,500;0,600;0,700;0,800;0,900;1,700;1,800;1,900&family=DM+Sans:wght@400;450;500;550;600;650;700;750;800&display=swap" rel="stylesheet" /></head><body>{children}</body></html>;
}
