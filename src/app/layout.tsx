import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AR Face Mesh | WebAR Face Tracking",
  description:
    "Real-time MediaPipe face tracking with 468 landmarks — runs entirely in the browser.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased overflow-hidden select-none">
        {children}
      </body>
    </html>
  );
}
