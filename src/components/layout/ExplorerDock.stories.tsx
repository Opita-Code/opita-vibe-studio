import type { Meta, StoryObj } from "@storybook/react";
import { ExplorerDock } from "./ExplorerDock";
import { useUIStore } from "@/stores/ui";
import { useProjectStore } from "@/stores/project";
import { useEffect } from "react";

const meta: Meta<typeof ExplorerDock> = {
  title: "Layout/ExplorerDock",
  component: ExplorerDock,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="h-screen bg-[#1e1e1e] flex flex-row">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Expanded: Story = {
  decorators: [
    (Story) => {
      useEffect(() => {
        useUIStore.setState({ explorerVisible: true });
        useProjectStore.setState({ 
          activeWorkspaceId: "/mock/project",
          workspaces: [{
            id: "/mock/project",
            name: "proyecto",
            path: "/mock/project",
            isGitRepo: false,
            gitBranch: null,
            files: [
              { name: "index.js", path: "/mock/project/index.js", type: "file" },
              { name: "src", path: "/mock/project/src", type: "directory", children: [] },
            ]
          }],
        });
      }, []);
      return <Story />;
    },
  ],
};

export const Collapsed: Story = {
  decorators: [
    (Story) => {
      useEffect(() => {
        useUIStore.setState({ explorerVisible: false });
      }, []);
      return <Story />;
    },
  ],
};
