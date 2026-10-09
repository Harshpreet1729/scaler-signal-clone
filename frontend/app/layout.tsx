import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signal-inspired Messenger | Scaler Assignment",
  description: "An original messaging assignment with demo accounts, persistent direct and group chats, and real-time delivery. No real end-to-end encryption.",
  icons: { icon: "data:," },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
