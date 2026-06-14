import { useEffect, useState } from "react";

// Minimaler Toast: ueberall per notify("…") ausloesbar, ohne Context-Verkabelung.
export const notify = (message: string) => {
  window.dispatchEvent(new CustomEvent("wm2026:toast", { detail: message }));
};

export function Toast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    const handler = (event: Event) => {
      setMessage((event as CustomEvent<string>).detail);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setMessage(null), 4500);
    };
    window.addEventListener("wm2026:toast", handler);
    return () => {
      window.removeEventListener("wm2026:toast", handler);
      window.clearTimeout(timer);
    };
  }, []);

  if (!message) return null;
  return (
    <div className="fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 md:bottom-6" role="status" aria-live="polite">
      <div className="max-w-md rounded-lg border border-white/15 bg-night/95 px-4 py-3 text-sm font-semibold text-white shadow-2xl backdrop-blur">
        {message}
      </div>
    </div>
  );
}
