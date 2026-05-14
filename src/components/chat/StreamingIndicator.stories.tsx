import type { Meta, StoryObj } from "@storybook/react";
import { StreamingIndicator } from "./StreamingIndicator";

const meta: Meta<typeof StreamingIndicator> = {
  title: "Chat/StreamingIndicator",
  component: StreamingIndicator,
  parameters: {
    layout: "centered",
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

export const Default: Story = {};
