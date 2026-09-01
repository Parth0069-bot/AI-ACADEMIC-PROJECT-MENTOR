"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { WifiOff } from "lucide-react";
import { notify } from "@/lib/notify";

/**
 * Surfaces browser connectivity changes.
 *
 * Students on campus/hostel wifi lose connection more often than a
 * typical desktop-office user, and this app leans heavily on
 * network calls (Gemini agent runs, chat, document generation,
 * Supabase reads/writes) with no offline queue -- a submission that
 * silently fails because the network dropped is a confusing, easy
 * to lose place in a form. This makes the state visible instead of
 * letting requests fail quietly.
 *
 * - Offline: a persistent slim banner at the top of the page (a
 *   toast that auto-dismisses in a few seconds isn't useful for a
 *   state that might last minutes).
 * - Back online: the banner clears and a brief confirmation toast
 *   fires, using the same react-hot-toast instance already set up
 *   in app/layout.tsx.
 *
 * Renders nothing during SSR/hydration (navigator.onLine isn't
 * available on the server) and nothing at all if the browser has
 * always been online this session, so this adds zero visual weight
 * for the common case.
 */

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

// The server has no concept of connectivity, so it always "sees"
// online -- this must match the client's very first render (before
// the subscription above has a chance to run) or React flags a real
// hydration mismatch, not just a next-themes false positive.
function getServerSnapshot() {
  return true;
}

export function ConnectivityBanner() {
  // useSyncExternalStore is the correct primitive for a value owned
  // by a browser API rather than React: it guarantees the first
  // client render matches the server snapshot, then re-renders once
  // subscribed, with no manual setState-in-effect needed.
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Only used to decide whether "back online" deserves a toast; a
  // ref is enough since it doesn't need to trigger a re-render.
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
      return;
    }
    if (wasOfflineRef.current) {
      notify.success("Back online");
      wasOfflineRef.current = false;
    }
  }, [isOnline]);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="flex items-center justify-center gap-2 bg-coral-500 px-4 py-2 text-center text-sm font-medium text-white">
            <WifiOff size={15} />
            You&apos;re offline -- some features may not work until your
            connection is restored.
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
