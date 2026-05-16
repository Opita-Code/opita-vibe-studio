import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGamificationStore } from "@/stores/gamification";

interface Particle {
  id: string;
  xStart: number;
  yStart: number;
  xMid: number;
  yMid: number;
  xEnd: number;
  yEnd: number;
  color: string;
  size: number;
  delay: number;
}

const COLORS = ["#06b6d4", "#a855f7", "#3b82f6", "#10b981", "#f59e0b"];

export function XPParticleSystem() {
  const xpBurstEvent = useGamificationStore((s) => s.xpBurstEvent);
  const clearXPBurst = useGamificationStore((s) => s.clearXPBurst);
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!xpBurstEvent) return;

    // Get origin (Toast) and destination (XP Bar)
    const toastEl = document.getElementById("gamification-toast");
    const xpBarEl = document.getElementById("gamification-xp-bar");

    // Default coordinates if elements are missing (fallback)
    let originX = window.innerWidth / 2;
    let originY = window.innerHeight - 100;
    let destX = 20;
    let destY = window.innerHeight - 50;

    if (toastEl) {
      const rect = toastEl.getBoundingClientRect();
      originX = rect.left + rect.width / 2;
      originY = rect.top + rect.height / 2;
    }

    if (xpBarEl) {
      const rect = xpBarEl.getBoundingClientRect();
      destX = rect.left + rect.width / 2;
      destY = rect.top + rect.height / 2;
    }

    // Determine particle count based on XP (capped at 25)
    const count = Math.min(Math.max(Math.floor(xpBurstEvent.amount / 10), 8), 25);
    const newParticles: Particle[] = [];

    for (let i = 0; i < count; i++) {
      // "Fountain" effect: burst upwards and outwards before pulling to destination
      const spreadX = (Math.random() - 0.5) * 200;
      const burstUp = Math.random() * 150 + 50;

      newParticles.push({
        id: `${xpBurstEvent.id}-${i}`,
        xStart: originX,
        yStart: originY,
        xMid: originX + spreadX,
        yMid: originY - burstUp,
        xEnd: destX,
        yEnd: destY,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: Math.random() * 6 + 4, // 4px to 10px
        delay: Math.random() * 0.2, // 0 to 200ms stagger
      });
    }

    setParticles((prev) => [...prev, ...newParticles]);

    // Clear the event so it can be triggered again
    clearXPBurst(xpBurstEvent.id);

    // Clean up particles after they finish animating (longest duration is ~1.5s + 0.2s delay)
    const timer = setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !newParticles.includes(p)));
    }, 2000);

    return () => clearTimeout(timer);
  }, [xpBurstEvent, clearXPBurst]);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[200] overflow-hidden">
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ 
              x: p.xStart, 
              y: p.yStart, 
              scale: 0,
              opacity: 1 
            }}
            animate={{
              x: [p.xStart, p.xMid, p.xEnd],
              y: [p.yStart, p.yMid, p.yEnd],
              scale: [0, 1.5, 1, 0.5],
              opacity: [1, 1, 1, 0],
            }}
            transition={{
              duration: 1.2,
              ease: ["easeOut", "easeInOut"], // fast out, smooth in
              times: [0, 0.4, 1], // keyframe timings
              delay: p.delay,
            }}
            exit={{ opacity: 0, scale: 0 }}
            className="absolute rounded-full shadow-[0_0_10px_currentColor]"
            style={{
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              color: p.color, // For shadow
              marginLeft: -p.size / 2, // Center origin
              marginTop: -p.size / 2,
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
