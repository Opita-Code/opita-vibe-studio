import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileHubView } from "../../../src/components/layout/MobileHubView";
import { AuraStepChips } from "../../../src/components/chat/AuraStepChips";
import { useAuthStore } from "../../../src/stores/auth";
import { useGamificationStore } from "../../../src/stores/gamification";
import { useChatStore } from "../../../src/stores/chat";
import { useProjectStore } from "../../../src/stores/project";

vi.mock("../../../src/components/usage/PlanCard", () => ({
  PlanCard: () => <div data-testid="plan-card" />,
}));

const auraStepsMock = vi.hoisted(() => ({
  getNextSteps: vi.fn(() => []),
  buildStepContext: vi.fn(() => ({})),
}));

vi.mock("../../../src/lib/aura-steps", () => auraStepsMock);



const PROFILE = {
  totalXp: 1200,
  level: 4,
  streakDays: 6,
  lastActiveDate: "",
  earnedQuota: 0,
  effectiveDailyQuota: 150000,
};

describe("MobileHubView", () => {
  beforeEach(() => {
    useAuthStore.setState({ authMode: "guest" } as never);
    useGamificationStore.setState({ profile: null, missions: [], progressPercent: 0, xpRemaining: 0 } as never);
  });

  it("should show the locked state for guests", () => {
    render(<MobileHubView />);
    expect(screen.getByText("Desbloquea tu Hub")).toBeDefined();
    expect(screen.getByText("Iniciar sesión")).toBeDefined();
  });

  it("should render the dashboard for authenticated users", () => {
    useAuthStore.setState({ authMode: "authenticated" } as never);
    useGamificationStore.setState({ profile: PROFILE, progressPercent: 50, xpRemaining: 200 } as never);
    render(<MobileHubView />);
    expect(screen.getByText("Nivel 4")).toBeDefined();
    expect(screen.getByText("1200 XP")).toBeDefined();
    expect(screen.getByText("6")).toBeDefined();
    expect(screen.getByText("200 XP para el siguiente nivel")).toBeDefined();
    expect(screen.getByTestId("plan-card")).toBeDefined();
  });

  it("should render missions with progress counts", () => {
    useAuthStore.setState({ authMode: "authenticated" } as never);
    useGamificationStore.setState({
      profile: PROFILE,
      missions: [
        { id: "a", type: "construir", title: "Hecha", description: "d", xpReward: 50, quotaReward: 1000, difficulty: "novato", completed: true },
        { id: "b", type: "explorar", title: "Pendiente", description: "d2", xpReward: 60, quotaReward: 2000, difficulty: "novato", completed: false },
      ],
    } as never);
    render(<MobileHubView />);
    expect(screen.getByText("Hecha")).toBeDefined();
    expect(screen.getByText("Pendiente")).toBeDefined();
    expect(screen.getByText("1/2")).toBeDefined();
    expect(screen.getByText("+50 XP")).toBeDefined();
  });

  it("should show the empty missions state", () => {
    useAuthStore.setState({ authMode: "authenticated" } as never);
    useGamificationStore.setState({ profile: PROFILE, missions: [] } as never);
    render(<MobileHubView />);
    expect(screen.getByText("Sin misiones activas")).toBeDefined();
  });

  it("should hide the streak badge when there is no streak", () => {
    useAuthStore.setState({ authMode: "authenticated" } as never);
    useGamificationStore.setState({ profile: { ...PROFILE, streakDays: 0 } } as never);
    render(<MobileHubView />);
    expect(screen.queryByText("0")).toBeNull();
  });
});

describe("AuraStepChips", () => {
  beforeEach(() => {
    useChatStore.setState({
      activeSessionId: "s1",
      sessions: { s1: { id: "s1", title: "t", messages: [], createdAt: 0, updatedAt: 0 } },
      isStreaming: false,
      pipelinePhase: null,
    } as never);
    useProjectStore.setState({ workspaces: [], openTabs: [] } as never);
    auraStepsMock.getNextSteps.mockReturnValue([]);
  });

  it("should render nothing when there are no steps", () => {
    const { container } = render(<AuraStepChips onStepClick={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("should render nothing while streaming", () => {
    useChatStore.setState({ isStreaming: true } as never);
    auraStepsMock.getNextSteps.mockReturnValue([{ id: "s", icon: "🔧", label: "Revisar", action: "review" }]);
    const { container } = render(<AuraStepChips onStepClick={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("should render suggested steps and trigger onStepClick", () => {
    useChatStore.setState({
      sessions: {
        s1: {
          id: "s1", title: "t",
          messages: [{ id: "m", role: "assistant", content: "Listo", timestamp: Date.now() }],
          createdAt: 0, updatedAt: 0,
        },
      },
    } as never);
    auraStepsMock.getNextSteps.mockReturnValue([
      { id: "s1", icon: "🔧", label: "Revisar código", action: "review" },
      { id: "s2", icon: "🚀", label: "Desplegar", action: "deploy" },
    ]);
    const onStepClick = vi.fn();
    render(<AuraStepChips onStepClick={onStepClick} />);
    expect(screen.getByText("Aura sugiere")).toBeDefined();
    expect(screen.getByText("Revisar código")).toBeDefined();
    expect(screen.getByText("Desplegar")).toBeDefined();
    fireEvent.click(screen.getByText("Revisar código"));
    expect(onStepClick).toHaveBeenCalledWith("review");
  });

  it("should not show steps when the last message is a user message", () => {
    useChatStore.setState({
      sessions: {
        s1: {
          id: "s1", title: "t",
          messages: [{ id: "m", role: "user", content: "Hola", timestamp: Date.now() }],
          createdAt: 0, updatedAt: 0,
        },
      },
    } as never);
    auraStepsMock.getNextSteps.mockReturnValue([{ id: "s", icon: "x", label: "x", action: "x" }]);
    const { container } = render(<AuraStepChips onStepClick={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
});
