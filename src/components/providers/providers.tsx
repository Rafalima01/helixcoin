"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: "#1A1228",
            color: "#FFFFFF",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "14px",
            padding: "12px 16px",
            fontSize: "14px",
            boxShadow: "0 8px 40px rgba(0,0,0,0.45)",
          },
          success: {
            iconTheme: { primary: "#16F2A5", secondary: "#1A1228" },
          },
          error: {
            iconTheme: { primary: "#FF4D6D", secondary: "#1A1228" },
          },
        }}
      />
    </QueryClientProvider>
  );
}
