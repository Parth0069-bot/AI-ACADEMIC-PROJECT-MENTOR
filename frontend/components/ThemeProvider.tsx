"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";

// next-themes renders an inline <script> to set the theme class
// before hydration (avoids a flash of the wrong theme). React 19
// added a warning for any <script> rendered inside a component --
// next-themes hasn't shipped a fix (github.com/pacocoursey/next-themes
// issues #385/#387), and the script still runs correctly during SSR,
// so this is a known false positive, not a real bug. Filtering just
// this one message in dev keeps the console useful without hiding
// any other error.
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Encountered a script tag")
    ) {
      return;
    }
    originalConsoleError.apply(console, args);
  };
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
