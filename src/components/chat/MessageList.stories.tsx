import type { Meta, StoryObj } from "@storybook/react";
import { MessageList } from "./MessageList";

const meta: Meta<typeof MessageList> = {
  title: "Chat/MessageList",
  component: MessageList,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="bg-[#1e1e1e] p-4 max-w-xl h-[400px] flex flex-col border border-white/10">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    messages: [],
    isStreaming: false,
  },
};

export const WithMessages: Story = {
  args: {
    messages: [
      { id: "1", role: "user", content: "Hola", timestamp: Date.now() },
      { id: "2", role: "assistant", content: "¡Hola! ¿En qué te ayudo?", timestamp: Date.now() },
    ],
    isStreaming: false,
  },
};

export const Streaming: Story = {
  args: {
    messages: [
      { id: "1", role: "user", content: "Escribe un poema corto", timestamp: Date.now() },
      { id: "2", role: "assistant", content: "El cielo es azul...", timestamp: Date.now() },
    ],
    isStreaming: true,
  },
};
