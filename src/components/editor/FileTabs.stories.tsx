import type { Meta, StoryObj } from "@storybook/react";
import { FileTabs } from "./FileTabs";
import { useProjectStore } from "@/stores/project";
import { useEffect } from "react";

const meta: Meta<typeof FileTabs> = {
  title: "Editor/FileTabs",
  component: FileTabs,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="bg-[#1e1e1e] p-4 w-full">
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
        useProjectStore.setState({
          openTabs: ["/src/App.tsx", "/src/index.css", "/README.md"],
          activeTab: "/src/App.tsx",
          isDirty: { "/src/App.tsx": true, "/src/index.css": false, "/README.md": false }
        });
      }, []);
      return <Story />;
    },
  ],
};

export const Empty: Story = {
  decorators: [
    (Story) => {
      useEffect(() => {
        useProjectStore.setState({
          openTabs: [],
          activeTab: null,
          isDirty: {}
        });
      }, []);
      return <Story />;
    },
  ],
};
