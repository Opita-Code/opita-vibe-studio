import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WompiModal } from "../../../src/components/usage/WompiModal";
import { usePurchaseIntentStore } from "../../../src/hooks/usePurchaseIntent";
import { useAuthStore } from "../../../src/stores/auth";

vi.mock("../../../src/lib/analytics", () => ({
  analytics: { track: vi.fn() },
}));

function openModal(plan: "free" | "pro" = "free") {
  usePurchaseIntentStore.setState({ wompiModalOpen: true, forcedIntent: null });
  useAuthStore.setState({ user: { id: "u1", email: "a@b.co", name: "T", plan, verified: false }, session: { token: "tok", expiresAt: Date.now() + 1e6 }, plan } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  usePurchaseIntentStore.setState({ wompiModalOpen: false, forcedIntent: null });
});

describe("WompiModal", () => {
  it("should render nothing when closed", () => {
    render(<WompiModal />);
    expect(screen.queryByText(/Mejorar a/)).toBeNull();
  });

  it("should render the upgrade modal for free plan", () => {
    openModal("free");
    render(<WompiModal />);
    expect(screen.getByText("Mejorar a Estudiante")).toBeDefined();
    expect(screen.getByText("250K tokens diarios")).toBeDefined();
  });

  it("should render the upgrade modal for pro plan", () => {
    openModal("pro");
    render(<WompiModal />);
    expect(screen.getByText("Mejorar a Vibe Pro")).toBeDefined();
    expect(screen.getByText("1M tokens diarios")).toBeDefined();
  });

  it("should close the modal via the close button", () => {
    openModal("free");
    render(<WompiModal />);
    fireEvent.click(screen.getByLabelText("Cerrar modal"));
    expect(usePurchaseIntentStore.getState().wompiModalOpen).toBe(false);
  });

  it("should fetch a checkout signature and inject the Wompi script", async () => {
    openModal("free");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ publicKey: "pk", currency: "COP", amountInCents: 100, reference: "ref", signature: "sig" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WompiModal />);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // script injected
    expect(document.querySelector('script[src="https://checkout.wompi.co/widget.js"]')).toBeDefined();
    vi.unstubAllGlobals();
  });

  it("should show a loading state while fetching the signature", async () => {
    openModal("free");
    let resolveFetch: (v: unknown) => void = () => {};
    vi.stubGlobal("fetch", vi.fn(() => new Promise((res) => { resolveFetch = res; })));

    render(<WompiModal />);
    expect(await screen.findByText("Cargando pasarela segura...")).toBeDefined();
    resolveFetch({ ok: true, json: async () => ({ publicKey: "pk", currency: "COP", amountInCents: 100, reference: "ref", signature: "sig" }) });
    vi.unstubAllGlobals();
  });

  it("should show an error when the signature fetch fails", async () => {
    openModal("free");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    render(<WompiModal />);
    expect(await screen.findByText(/Error obteniendo configuración de pago/)).toBeDefined();
    vi.unstubAllGlobals();
  });

  it("should show an error when the signature request throws", async () => {
    openModal("free");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    render(<WompiModal />);
    expect(await screen.findByText("network down")).toBeDefined();
    vi.unstubAllGlobals();
  });
});
