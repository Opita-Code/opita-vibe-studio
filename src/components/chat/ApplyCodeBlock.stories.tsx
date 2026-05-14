import type { Meta, StoryObj } from "@storybook/react";
import { ApplyCodeBlock } from "./ApplyCodeBlock";

const meta: Meta<typeof ApplyCodeBlock> = {
  title: "Chat/ApplyCodeBlock",
  component: ApplyCodeBlock,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="bg-[#1e1e1e] p-4 max-w-2xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

const sampleCode = `function saludar(nombre: string) {
  console.log("Hola, " + nombre);
}

saludar("Vibe Studio");`;

export const Default: Story = {
  args: {
    code: sampleCode,
    language: "typescript",
  },
};

export const InlineCode: Story = {
  args: {
    code: "npm install react",
    language: undefined,
  },
};
