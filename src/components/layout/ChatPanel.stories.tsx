import type { Meta, StoryObj } from "@storybook/react";
import { ChatPanel } from "./ChatPanel";

const meta: Meta<typeof ChatPanel> = {
  title: "Layout/ChatPanel",
  component: ChatPanel,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="h-screen bg-[#1e1e1e] flex flex-row justify-end">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    width: 400,
  },
};
