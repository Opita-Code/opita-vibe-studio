import type { Meta, StoryObj } from "@storybook/react";
import { TerminalPanel } from "./TerminalPanel";

const meta: Meta<typeof TerminalPanel> = {
  title: "Terminal/TerminalPanel",
  component: TerminalPanel,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="h-screen w-full bg-[#1e1e1e] flex flex-col justify-end">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    height: 300,
  },
};
