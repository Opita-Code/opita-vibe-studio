import type { Meta, StoryObj } from "@storybook/react";
import { MessageBubble } from "./MessageBubble";

const meta: Meta<typeof MessageBubble> = {
  title: "Chat/MessageBubble",
  component: MessageBubble,
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

export const UserMessage: Story = {
  args: {
    message: {
      id: "1",
      role: "user",
      content: "¿Puedes crear un botón rojo usando Tailwind?",
      timestamp: Date.now(),
    },
  },
};

export const AssistantMessage: Story = {
  args: {
    message: {
      id: "2",
      role: "assistant",
      content: "¡Claro! Aquí tienes el código para un botón rojo:\n\n\`\`\`tsx\n<button className=\"bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded\">\n  Mi Botón\n</button>\n\`\`\`",
      timestamp: Date.now(),
    },
  },
};

export const SystemMessage: Story = {
  args: {
    message: {
      id: "3",
      role: "system",
      content: "La sesión ha expirado",
      timestamp: Date.now(),
    },
  },
};
