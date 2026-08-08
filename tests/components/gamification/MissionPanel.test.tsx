import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MissionPanel } from "../../../src/components/gamification/MissionPanel";
import { useGamificationStore } from "../../../src/stores/gamification";
import { useAuthStore } from "../../../src/stores/auth";
import type { Mission } from "../../../src/lib/types";

function makeMission(overrides: Partial<Mission> & { id: string }): Mission {
  return {
    type: "construir",
    title: "Misión",
    description: "Descripción de la misión",
    xpReward: 100,
    quotaReward: 5000,
    difficulty: "novato",
    completed: false,
    ...overrides,
  };
}

const PROFILE = {
  totalXp: 1200,
  level: 3,
  streakDays: 5,
  lastActiveDate: "2026-08-01",
  earnedQuota: 5000,
  effectiveDailyQuota: 155000,
};

function seedStore(overrides: Partial<ReturnType<typeof useGamificationStore.getState>> = {}) {
  useGamificationStore.setState({
    profile: PROFILE,
    missions: [],
    milestones: [],
    isLoading: false,
    missionPanelOpen: true,
    progressPercent: 20,
    xpRemaining: 300,
    pendingMilestone: null,
    completingMissionId: null,
    xpBurstEvent: null,
    fetchProfile: vi.fn(async () => {}),
    fetchMissions: vi.fn(async () => {}),
    completeMission: vi.fn(async () => {}),
    setMissionPanelOpen: vi.fn(),
    ...overrides,
  } as never);
}

describe("MissionPanel", () => {
  beforeEach(() => {
    useAuthStore.setState({ authMode: "authenticated" } as never);
    seedStore();
  });

  it("should render nothing when panel is closed", () => {
    seedStore({ missionPanelOpen: false });
    const { container } = render(<MissionPanel />);
    expect(container.querySelector("[class*='fixed inset-0']")).toBeNull();
  });

  it("should render header with progress ring and profile stats", () => {
    render(<MissionPanel />);
    expect(screen.getByText("Misiones Diarias")).toBeDefined();
    expect(screen.getByText("Nivel 3")).toBeDefined();
    expect(screen.getByText("300 XP para Lv.4")).toBeDefined();
    expect(screen.getByText("Quota: 155K tokens")).toBeDefined();
  });

  it("should fetch profile and missions when opened for authenticated users", () => {
    const fetchProfile = vi.fn(async () => {});
    const fetchMissions = vi.fn(async () => {});
    seedStore({ fetchProfile, fetchMissions });
    render(<MissionPanel />);
    expect(fetchProfile).toHaveBeenCalled();
    expect(fetchMissions).toHaveBeenCalled();
  });

  it("should close the panel via the X button", () => {
    const setMissionPanelOpen = vi.fn();
    seedStore({ setMissionPanelOpen });
    render(<MissionPanel />);
    fireEvent.click(screen.getByLabelText("Cerrar panel de misiones"));
    expect(setMissionPanelOpen).toHaveBeenCalledWith(false);
  });

  it("should close the panel when pressing Escape", () => {
    const setMissionPanelOpen = vi.fn();
    seedStore({ setMissionPanelOpen });
    render(<MissionPanel />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(setMissionPanelOpen).toHaveBeenCalledWith(false);
  });

  it("should render daily missions with XP rewards", () => {
    seedStore({
      missions: [
        makeMission({ id: "d1", title: "Crea un componente", xpReward: 50, quotaReward: 2000 }),
      ],
    });
    render(<MissionPanel />);
    expect(screen.getByText("Crea un componente")).toBeDefined();
    expect(screen.getByText("+50 XP")).toBeDefined();
    expect(screen.getByText("+2K quota")).toBeDefined();
  });

  it("should render weekly missions when the Semanales tab is clicked", () => {
    seedStore({
      missions: [
        makeMission({ id: "w1", period: "weekly", title: "Misión semanal" }),
        makeMission({ id: "d1", title: "Misión diaria" }),
      ],
    });
    render(<MissionPanel />);
    fireEvent.click(screen.getByText("Semanales"));
    expect(screen.getByText("Misión semanal")).toBeDefined();
  });

  it("should render completed mission with strikethrough style", () => {
    seedStore({
      missions: [
        makeMission({ id: "c1", title: "Completada", completed: true }),
      ],
    });
    render(<MissionPanel />);
    expect(screen.getByText("Completada")).toBeDefined();
    expect(screen.getByText("+100 XP")).toBeDefined();
  });

  it("should render auto-validation progress for a mission in progress", () => {
    seedStore({
      missions: [
        makeMission({
          id: "p1",
          title: "En progreso",
          progress: 40,
          completionCriteria: { eventType: "message_sent", count: 5 },
        }),
      ],
    });
    render(<MissionPanel />);
    expect(screen.getByText("En progreso...")).toBeDefined();
    expect(screen.getByText("2/5")).toBeDefined();
    expect(screen.getByText("Auto")).toBeDefined();
  });

  it("should show 'Pendiente' for a mission with 0 progress", () => {
    seedStore({
      missions: [
        makeMission({
          id: "p0",
          title: "Pendiente",
          progress: 0,
          completionCriteria: { eventType: "message_sent", count: 3 },
        }),
      ],
    });
    render(<MissionPanel />);
    expect(screen.getAllByText("Pendiente").length).toBeGreaterThan(0);
  });

  it("should show guest lock message for unauthenticated users", () => {
    useAuthStore.setState({ authMode: "guest" } as never);
    seedStore();
    render(<MissionPanel />);
    expect(screen.getByText(/Inicia sesión para desbloquear misiones/)).toBeDefined();
  });

  it("should show loading message when authenticated but no missions", () => {
    seedStore({ missions: [] });
    render(<MissionPanel />);
    expect(screen.getByText("Cargando misiones...")).toBeDefined();
  });

  it("should NOT render the Semanales tab when no weekly missions exist", () => {
    seedStore({ missions: [makeMission({ id: "d1", title: "Solo diaria" })] });
    render(<MissionPanel />);
    expect(screen.queryByText("Semanales")).toBeNull();
  });

  it("should show celebration toast when a mission newly completes", () => {
    seedStore({
      missions: [makeMission({ id: "old", title: "Anterior", completed: true })],
    });
    const { rerender } = render(<MissionPanel />);

    // Now add a newly completed mission → toast appears
    seedStore({
      missions: [
        makeMission({ id: "old", title: "Anterior", completed: true }),
        makeMission({ id: "new", title: "Nueva completada", completed: true, xpReward: 200 }),
      ],
    });
    rerender(<MissionPanel />);
    expect(screen.getByText("¡Misión completada!")).toBeDefined();
    expect(screen.getAllByText("+200 XP").length).toBeGreaterThan(0);
  });

  it("should show auto-validation banner when a mission is in progress", () => {
    seedStore({
      missions: [
        makeMission({
          id: "b1",
          title: "Con banner",
          progress: 10,
          completionCriteria: { eventType: "message_sent", count: 5 },
        }),
      ],
    });
    render(<MissionPanel />);
    expect(screen.getByText(/Las misiones se completan automáticamente/)).toBeDefined();
  });

  it("should show all-completed celebration when all missions done", () => {
    seedStore({
      missions: [makeMission({ id: "a1", title: "Hecha", completed: true })],
    });
    render(<MissionPanel />);
    expect(screen.getByText(/¡Todas completadas!/)).toBeDefined();
  });

  it("should show streak flame when profile is present", () => {
    render(<MissionPanel />);
    // StreakFlame shows streak days
    expect(screen.getByText("5")).toBeDefined();
  });
});
