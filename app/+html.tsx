import { ScrollViewStyleReset } from 'expo-router/html';
import React from 'react';

const favicon =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='26' fill='%23174c35'/%3E%3Ctext x='50' y='70' font-size='56' text-anchor='middle'%3E%F0%9F%8C%B1%3C/text%3E%3C/svg%3E";

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>AgroGear — Agricultural Equipment Marketplace</title>
        <meta
          name="description"
          content="Discover, rent, and list agricultural machinery in one trusted marketplace built for African farmers."
        />
        <meta name="theme-color" content="#174c35" />
        <meta property="og:title" content="AgroGear — Agricultural Equipment Marketplace" />
        <meta
          property="og:description"
          content="The right machine. The right season. Rent and list farm equipment across Nigeria."
        />
        <link rel="icon" href={favicon} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossOrigin="anonymous" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: 'body{background-color:#f8f7f0;}' }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
