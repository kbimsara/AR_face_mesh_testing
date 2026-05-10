"use client";

interface Props {
  message: string;
  onRetry: () => void;
}

export function PermissionError({ message, onRetry }: Props) {
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black p-6"
      role="alertdialog"
      aria-modal="true"
    >
      <div className="max-w-sm w-full flex flex-col items-center gap-5 text-center">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="#EF4444" strokeWidth="1.5" />
          <path d="M12 7v5M12 16.5h.01" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
        </svg>

        <div className="space-y-1">
          <h2 className="text-white font-semibold">Camera Error</h2>
          <p className="text-sm text-gray-400 leading-relaxed">{message}</p>
        </div>

        <button
          onClick={onRetry}
          className="px-6 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
