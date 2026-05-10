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
      aria-label="Camera access error"
    >
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,0,0,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,0,0,0.5) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div
        className="relative max-w-sm w-full rounded border border-red-700 bg-black p-8 flex flex-col items-center gap-6"
        style={{ boxShadow: "0 0 40px rgba(255,0,0,0.25), inset 0 0 40px rgba(255,0,0,0.05)" }}
      >
        {/* Corner decorations */}
        {["top-0 left-0", "top-0 right-0", "bottom-0 left-0", "bottom-0 right-0"].map(
          (pos) => (
            <span
              key={pos}
              className={`absolute ${pos} w-3 h-3 border-red-500`}
              style={{
                borderWidth: "2px 0 0 2px",
                ...(pos.includes("right") ? { borderWidth: "2px 2px 0 0" } : {}),
                ...(pos.includes("bottom") && pos.includes("left")
                  ? { borderWidth: "0 0 2px 2px" }
                  : {}),
                ...(pos.includes("bottom") && pos.includes("right")
                  ? { borderWidth: "0 2px 2px 0" }
                  : {}),
              }}
            />
          )
        )}

        {/* Error icon */}
        <div
          className="w-16 h-16 rounded-full border-2 border-red-500 flex items-center justify-center flex-shrink-0"
          style={{ boxShadow: "0 0 24px rgba(255,0,0,0.4)" }}
          aria-hidden="true"
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#EF4444" strokeWidth="1.5" />
            <path
              d="M12 7v5M12 16.5h.01"
              stroke="#EF4444"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Heading */}
        <div className="text-center space-y-2">
          <h2
            className="text-lg font-bold tracking-[0.2em] uppercase"
            style={{ color: "#EF4444", textShadow: "0 0 12px rgba(239,68,68,0.6)" }}
          >
            Access Error
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed">{message}</p>
        </div>

        {/* Retry button */}
        <button
          onClick={onRetry}
          className="w-full py-3 rounded text-sm font-bold tracking-[0.2em] uppercase transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon"
          style={{
            border: "1px solid #00FF41",
            color: "#00FF41",
            background: "transparent",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#00FF41";
            (e.currentTarget as HTMLButtonElement).style.color = "#000";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "#00FF41";
          }}
        >
          Retry
        </button>

        <p className="text-xs text-gray-700 tracking-widest text-center">
          Ensure camera permissions are granted in your browser settings
        </p>
      </div>
    </div>
  );
}
