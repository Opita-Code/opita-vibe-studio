import type { Meta, StoryObj } from "@storybook/react";
import { LivePreview } from "./LivePreview";

const meta: Meta<typeof LivePreview> = {
  title: "Preview/LivePreview",
  component: LivePreview,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="h-screen w-full bg-[#1e1e1e] flex">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyState: Story = {
  args: {
    version: 1,
  },
};

export const RenderedHTML: Story = {
  args: {
    version: 1,
  },
};

export const FullDocument: Story = {
  args: {
    version: 1,
  },
};

export const WithErrorScript: Story = {
  args: {
    version: 1,
  },
};
