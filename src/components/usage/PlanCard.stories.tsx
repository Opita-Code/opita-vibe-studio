import type { Meta, StoryObj } from "@storybook/react";
import { PlanCard } from "./PlanCard";

const meta: Meta<typeof PlanCard> = {
  title: "Usage/PlanCard",
  component: PlanCard,
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
