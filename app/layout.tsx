import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Academic Project Mentor",
  description: "Your AI-powered academic project mentor",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3200,
            style: {
              background: "#1a1533",
              color: "#fff",
              borderRadius: "12px",
              fontSize: "14px",
              padding: "12px 16px",
            },
            success: { iconTheme: { primary: "#22c58b", secondary: "#fff" } },
            error: { iconTheme: { primary: "#ff6b81", secondary: "#fff" } },
          }}
        />
      </body>
    </html>
  );
}
