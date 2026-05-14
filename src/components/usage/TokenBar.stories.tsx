import type { Meta, StoryObj } from "@storybook/react";
import { TokenBar } from "./TokenBar";

const meta: Meta<typeof TokenBar> = {
  title: "Usage/TokenBar",
  component: TokenBar,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="bg-[#1e1e1e] p-4 max-w-sm">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
