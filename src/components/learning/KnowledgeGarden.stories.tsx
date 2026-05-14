import type { Meta, StoryObj } from "@storybook/react";
import { KnowledgeGarden } from "./KnowledgeGarden";

const meta: Meta<typeof KnowledgeGarden> = {
  title: "Learning/KnowledgeGarden",
  component: KnowledgeGarden,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="bg-[#1e1e1e] p-4 h-screen">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
