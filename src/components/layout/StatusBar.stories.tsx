import type { Meta, StoryObj } from "@storybook/react";
import { StatusBar } from "./StatusBar";
import { useUIStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import { useProjectStore } from "@/stores/project";
import { useEffect } from "react";

const meta: Meta<typeof StatusBar> = {
  title: "Layout/StatusBar",
  component: StatusBar,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="h-screen bg-[#1e1e1e] flex flex-col justify-end">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  decorators: [
    (Story) => {
      useEffect(() => {
        useUIStore.setState({ connectedProvider: "Anthropic", activeModel: "claude-3-opus", tokensRemaining: 150000, statusMessage: "Listo" });
        useProjectStore.setState({ 
          activeWorkspaceId: "mock-ws",
          workspaces: [{ id: "mock-ws", name: "Mock Project", path: "/mock/path", files: [], isGitRepo: true, gitBranch: "main" }]
        });
        useAuthStore.setState({ authMode: "authenticated", user: { id: "1", email: "user@example.com", name: "User", verified: true, plan: "pro" } });
      }, []);
      return <Story />;
    },
  ],
};

export const Disconnected: Story = {
  decorators: [
    (Story) => {
      useEffect(() => {
        useUIStore.setState({ connectedProvider: "", activeModel: "", tokensRemaining: 0, statusMessage: "Desconectado" });
        useProjectStore.setState({ 
          activeWorkspaceId: "mock-ws",
          workspaces: [{ id: "mock-ws", name: "Mock Project", path: "/mock/path", files: [], isGitRepo: false, gitBranch: null }]
        });
        useAuthStore.setState({ authMode: "unauthenticated", user: null });
      }, []);
      return <Story />;
    },
  ],
};
