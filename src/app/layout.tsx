import type { Metadata } from 'next';
// @ts-ignore Next.js provides CSS import handling and declarations through next-env.d.ts.
import './globals.css';

export const metadata: Metadata = {
  title: 'Tokiko Engineering (Pvt)Ltd',
  description: 'Quotation, Invoice, GRN, Multi-Serial Number & Warranty Tracking POS',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col antialiased">{children}</body>
    </html>
  );
}
