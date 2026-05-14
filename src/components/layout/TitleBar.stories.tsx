import type { Meta, StoryObj } from "@storybook/react";
import { TitleBar } from "./TitleBar";

const meta: Meta<typeof TitleBar> = {
  title: "Layout/TitleBar",
  component: TitleBar,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="h-screen bg-[#1e1e1e]">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
