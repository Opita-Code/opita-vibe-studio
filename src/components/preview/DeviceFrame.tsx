/**
 * DeviceFrame — CSS-only device frames for VibeLens mobile preview.
 *
 * Wraps the preview content in a phone/tablet chrome to give
 * users a realistic view of how their app looks on different devices.
 *
 * All frames are pure CSS — no images or SVGs needed.
 */

// ─── Types ──────────────────────────────────────────────────────

export type PreviewDevice = "desktop" | "iphone" | "android" | "tablet";

export interface DeviceSpec {
  name: string;
  width: number;
  height: number;
  /** Border radius of the screen area */
  screenRadius: number;
  /** Whether to show the notch/dynamic island */
  hasNotch: boolean;
  /** Pixel ratio for display density simulation */
  scale: number;
}

export const DEVICE_SPECS: Record<PreviewDevice, DeviceSpec> = {
  desktop: { name: "Escritorio", width: 0, height: 0, screenRadius: 0, hasNotch: false, scale: 1 },
  iphone: { name: "iPhone 15", width: 393, height: 852, screenRadius: 48, hasNotch: true, scale: 1 },
  android: { name: "Pixel 8", width: 412, height: 915, screenRadius: 28, hasNotch: false, scale: 1 },
  tablet: { name: "iPad Air", width: 820, height: 1180, screenRadius: 18, hasNotch: false, scale: 0.6 },
};

// ─── Component ──────────────────────────────────────────────────

interface DeviceFrameProps {
  device: PreviewDevice;
  children: React.ReactNode;
}

export function DeviceFrame({ device, children }: DeviceFrameProps) {
  // Desktop = no frame, render children directly
  if (device === "desktop") {
    return <div className="w-full h-full">{children}</div>;
  }

  const spec = DEVICE_SPECS[device];
  const scaledWidth = spec.width * spec.scale;
  const scaledHeight = spec.height * spec.scale;

  return (
    <div className="w-full h-full flex items-center justify-center bg-obsidian-950 p-4 overflow-auto">
      {/* Device shell */}
      <div
        className="relative shrink-0 bg-[#1a1a1a] shadow-[0_20px_60px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05)] transition-all duration-500"
        style={{
          width: scaledWidth + 16,
          height: scaledHeight + 16,
          borderRadius: spec.screenRadius + 8,
          padding: 8,
        }}
      >
        {/* Side buttons (volume, power) */}
        {device === "iphone" && (
          <>
            <div className="absolute -left-[3px] top-[120px] w-[3px] h-[32px] bg-[#2a2a2a] rounded-l-sm" />
            <div className="absolute -left-[3px] top-[170px] w-[3px] h-[56px] bg-[#2a2a2a] rounded-l-sm" />
            <div className="absolute -left-[3px] top-[235px] w-[3px] h-[56px] bg-[#2a2a2a] rounded-l-sm" />
            <div className="absolute -right-[3px] top-[180px] w-[3px] h-[80px] bg-[#2a2a2a] rounded-r-sm" />
          </>
        )}

        {/* Screen area */}
        <div
          className="relative w-full h-full overflow-hidden bg-obsidian-950"
          style={{ borderRadius: spec.screenRadius }}
        >
          {/* Dynamic Island / Notch */}
          {spec.hasNotch && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
              <div className="w-[126px] h-[36px] bg-black rounded-full flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-[#1a1a2e] border border-[#2a2a3e]" />
              </div>
            </div>
          )}

          {/* Status bar */}
          <div className="absolute top-0 left-0 right-0 h-12 z-20 pointer-events-none flex items-center justify-between px-6 text-[11px] font-medium text-white/60">
            <span>9:41</span>
            <div className="flex items-center gap-1">
              {/* Signal */}
              <svg className="w-4 h-3" viewBox="0 0 16 12" fill="currentColor">
                <rect x="0" y="8" width="3" height="4" rx="0.5" />
                <rect x="4.5" y="5" width="3" height="7" rx="0.5" />
                <rect x="9" y="2" width="3" height="10" rx="0.5" />
                <rect x="13.5" y="0" width="2.5" height="12" rx="0.5" opacity="0.3" />
              </svg>
              {/* WiFi */}
              <svg className="w-4 h-3" viewBox="0 0 16 12" fill="currentColor">
                <path d="M8 10.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM4.2 8.2a5.4 5.4 0 017.6 0l-1.1 1.1a3.8 3.8 0 00-5.4 0L4.2 8.2zM1.4 5.4a9 9 0 0113.2 0l-1.1 1.1a7.4 7.4 0 00-11 0L1.4 5.4z" />
              </svg>
              {/* Battery */}
              <svg className="w-6 h-3" viewBox="0 0 24 12" fill="currentColor">
                <rect x="0" y="1" width="20" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1" />
                <rect x="1.5" y="2.5" width="14" height="7" rx="1" />
                <rect x="21" y="3.5" width="2" height="5" rx="0.5" />
              </svg>
            </div>
          </div>

          {/* Home indicator (bottom bar) */}
          {device === "iphone" && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
              <div className="w-[134px] h-[5px] bg-white/20 rounded-full" />
            </div>
          )}

          {/* Content (the actual preview) */}
          <div className="w-full h-full">
            {children}
          </div>
        </div>
      </div>

      {/* Device label */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] font-mono text-slate-600 uppercase tracking-wider">
        {spec.name} · {spec.width}×{spec.height}
      </div>
    </div>
  );
}
