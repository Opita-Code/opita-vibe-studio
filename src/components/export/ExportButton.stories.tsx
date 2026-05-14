import type { Meta, StoryObj } from "@storybook/react";
import { ExportButton } from "./ExportButton";
import { useProjectStore } from "@/stores/project";
import { useEffect } from "react";

const meta: Meta<typeof ExportButton> = {
  title: "Export/ExportButton",
  component: ExportButton,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="bg-slate-900 p-4 border border-white/10 rounded flex gap-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Enabled: Story = {
  decorators: [
    (Story) => {
      useEffect(() => {
        useProjectStore.setState({ 
          activeWorkspaceId: "/mock/project",
          workspaces: [{
            id: "/mock/project",
            name: "proyecto",
            path: "/mock/project",
            isGitRepo: false,
            gitBranch: null,
            files: [
              { name: "index.js", path: "/mock/project/index.js", type: "file" }
            ]
          }]
        });
      }, []);
      return <Story />;
    },
  ],
};

export const DisabledNoProject: Story = {
  decorators: [
    (Story) => {
      useEffect(() => {
        useProjectStore.setState({ activeWorkspaceId: null, workspaces: [] });
      }, []);
      return <Story />;
    },
  ],
};
