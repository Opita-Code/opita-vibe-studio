import type { Meta, StoryObj } from "@storybook/react";
import { SettingsPanel } from "./SettingsPanel";
import { useUIStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import { useEffect } from "react";

const meta: Meta<typeof SettingsPanel> = {
  title: "Settings/SettingsPanel",
  component: SettingsPanel,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="h-screen w-full bg-slate-900 overflow-hidden relative">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const OpenGuest: Story = {
  decorators: [
    (Story) => {
      useEffect(() => {
        useUIStore.setState({ settingsVisible: true });
        useAuthStore.setState({ authMode: "unauthenticated", user: null, session: null });
      }, []);
      return <Story />;
    },
  ],
};

export const OpenAuthenticated: Story = {
  decorators: [
    (Story) => {
      useEffect(() => {
        useUIStore.setState({ settingsVisible: true });
        useAuthStore.setState({ authMode: "authenticated", user: { id: "123", email: "user@example.com", name: "User", verified: true, plan: "pro" }, });
      }, []);
      return <Story />;
    },
  ],
};
