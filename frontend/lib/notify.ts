import toast from "react-hot-toast";
import { pushNotification } from "@/lib/notifications";

/**
 * Drop-in replacement for calling `toast.success` / `toast.error` directly.
 * Shows the same toast the app already shows, and additionally logs the
 * event into the persistent notification history behind the bell icon in
 * the Topbar, so successful actions (like a database submission) stay
 * visible after the toast disappears.
 */
export const notify = {
  success(message: string) {
    toast.success(message);
    pushNotification(message, "success");
  },
  error(message: string) {
    toast.error(message);
    pushNotification(message, "error");
  },
};
