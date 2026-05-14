import type { Meta, StoryObj } from "@storybook/react";
import { TipBanner } from "./TipBanner";

const meta: Meta<typeof TipBanner> = {
  title: "Learning/TipBanner",
  component: TipBanner,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="bg-[#1e1e1e] p-4 max-w-xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
