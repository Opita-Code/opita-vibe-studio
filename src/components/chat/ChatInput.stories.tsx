import type { Meta, StoryObj } from "@storybook/react";
import { ChatInput } from "./ChatInput";

const meta: Meta<typeof ChatInput> = {
  title: "Chat/ChatInput",
  component: ChatInput,
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

export const Default: Story = {
  args: {
    onSend: (text) => alert(`Enviando: ${text}`),
    disabled: false,
  },
};

export const Disabled: Story = {
  args: {
    onSend: () => {},
    disabled: true,
  },
};
