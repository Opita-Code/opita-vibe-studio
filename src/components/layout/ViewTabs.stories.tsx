import type { Meta, StoryObj } from "@storybook/react";
import { ViewTabs } from "./ViewTabs";
import { useUIStore } from "@/stores/ui";
import { useEffect } from "react";

const meta: Meta<typeof ViewTabs> = {
  title: "Layout/ViewTabs",
  component: ViewTabs,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="bg-[#1e1e1e] p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const EditorActive: Story = {
  decorators: [
    (Story) => {
      useEffect(() => {
        useUIStore.setState({ activeView: "editor" });
      }, []);
      return <Story />;
    },
  ],
};

export const PreviewActive: Story = {
  decorators: [
    (Story) => {
      useEffect(() => {
        useUIStore.setState({ activeView: "preview" });
      }, []);
      return <Story />;
    },
  ],
};
