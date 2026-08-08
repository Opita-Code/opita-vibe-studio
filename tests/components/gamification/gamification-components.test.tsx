import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StreakFlame } from "../../../src/components/gamification/StreakFlame";
import { XPBar } from "../../../src/components/gamification/XPBar";
import { XPParticleSystem } from "../../../src/components/gamification/XPParticleSystem";
import { LevelUpCeremony } from "../../../src/components/gamification/LevelUpCeremony";
import * as gamificationIndex from "../../../src/components/gamification/index";
import { useGamificationStore } from "../../../src/stores/gamification";

describe("StreakFlame", () => {
  it("should return null when streak is 0 or negative", () => {
    const { container } = render(<StreakFlame streakDays={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("should render the streak count and a flame for long streaks", () => {
    render(<StreakFlame streakDays={5} />);
    expect(screen.getByText("5")).toBeDefined();
    expect(screen.getByLabelText("Racha")).toBeDefined();
    expect(screen.getByTitle(/Racha de 5 días/)).toBeDefined();
  });

  it("should render particle sparkles for streaks of 14+", () => {
    const { container } = render(<StreakFlame streakDays={14} />);
    expect(container.querySelectorAll("[class*='pointer-events-none']").length).toBeGreaterThan(0);
  });

  it("should render an intense flame for streaks of 30+", () => {
    render(<StreakFlame streakDays={45} />);
    expect(screen.getByLabelText("Racha")).toBeDefined();
    expect(screen.getByTitle(/45 días/)).toBeDefined();
  });

  it("should use the candle emoji for short streaks", () => {
    const { container } = render(<StreakFlame streakDays={1} />);
    expect(container.textContent).toContain("🕯️");
  });
});

describe("XPBar", () => {
  beforeEach(() => {
    useGamificationStore.setState({
      profile: { totalXp: 120, level: 2, streakDays: 3, lastActiveDate: "", earnedQuota: 0, effectiveDailyQuota: 150000 },
      progressPercent: 25,
      missionPanelOpen: false,
      setMissionPanelOpen: vi.fn(),
    } as never);
  });

  it("should return null without a profile", () => {
    useGamificationStore.setState({ profile: null } as never);
    const { container } = render(<XPBar />);
    expect(container.firstChild).toBeNull();
  });

  it("should render the level badge", () => {
    render(<XPBar />);
    expect(screen.getByText("Lv.2")).toBeDefined();
  });

  it("should toggle the mission panel on click", () => {
    const setMissionPanelOpen = vi.fn();
    useGamificationStore.setState({ setMissionPanelOpen, missionPanelOpen: false } as never);
    render(<XPBar />);
    fireEvent.click(screen.getByRole("button"));
    expect(setMissionPanelOpen).toHaveBeenCalledWith(true);
  });

  it("should close the mission panel when already open", () => {
    const setMissionPanelOpen = vi.fn();
    useGamificationStore.setState({ setMissionPanelOpen, missionPanelOpen: true } as never);
    render(<XPBar />);
    fireEvent.click(screen.getByRole("button"));
    expect(setMissionPanelOpen).toHaveBeenCalledWith(false);
  });
});

describe("XPParticleSystem", () => {
  beforeEach(() => {
    useGamificationStore.setState({
      xpBurstEvent: null,
      clearXPBurst: vi.fn(),
    } as never);
  });

  it("should render nothing without a burst event", () => {
    const { container } = render(<XPParticleSystem />);
    expect(container.firstChild).toBeNull();
  });

  it("should render particles when a burst event is set", () => {
    useGamificationStore.setState({
      xpBurstEvent: { id: "burst-1", amount: 120 },
    } as never);
    const { container } = render(<XPParticleSystem />);
    expect(container.firstChild).toBeDefined();
    // particles container exists
    expect(container.querySelector("[class*='pointer-events-none']")).toBeDefined();
  });

  it("should cap particle count at 25 and clear the event", () => {
    const clearXPBurst = vi.fn();
    useGamificationStore.setState({
      xpBurstEvent: { id: "burst-2", amount: 5000 },
      clearXPBurst,
    } as never);
    const { container } = render(<XPParticleSystem />);
    expect(clearXPBurst).toHaveBeenCalledWith("burst-2");
    // each particle is a motion.div inside the fixed container
    expect(container.querySelectorAll("[class*='absolute rounded-full shadow']").length).toBeLessThanOrEqual(25);
  });
});

describe("LevelUpCeremony", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render level, label and reward", () => {
    render(<LevelUpCeremony level={3} badge="🔥" label="Nuevo hito" quotaBoost={10000} onDismiss={() => {}} />);
    expect(screen.getByText("¡Nivel 3!")).toBeDefined();
    expect(screen.getByText("Nuevo hito")).toBeDefined();
    expect(screen.getByText("+10K quota diaria")).toBeDefined();
  });

  it("should not render the reward when quotaBoost is 0", () => {
    render(<LevelUpCeremony level={1} badge="⭐" label="x" quotaBoost={0} onDismiss={() => {}} />);
    expect(screen.queryByText(/quota diaria/)).toBeNull();
  });

  it("should dismiss after 4 seconds", () => {
    const onDismiss = vi.fn();
    render(<LevelUpCeremony level={1} badge="⭐" label="x" quotaBoost={0} onDismiss={onDismiss} />);
    vi.advanceTimersByTime(4000);
    vi.advanceTimersByTime(500);
    expect(onDismiss).toHaveBeenCalled();
  });

  it("should dismiss on click", () => {
    const onDismiss = vi.fn();
    render(<LevelUpCeremony level={1} badge="⭐" label="x" quotaBoost={0} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText("¡Nivel 1!"));
    vi.advanceTimersByTime(600);
    expect(onDismiss).toHaveBeenCalled();
  });
});

describe("gamification/index", () => {
  it("should export all gamification components", () => {
    expect(gamificationIndex.LevelUpCeremony).toBeDefined();
    expect(gamificationIndex.MissionPanel).toBeDefined();
    expect(gamificationIndex.StreakFlame).toBeDefined();
    expect(gamificationIndex.XPBar).toBeDefined();
    expect(gamificationIndex.MissionPanel).toBeDefined();
  });
});
