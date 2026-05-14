import type { Meta, StoryObj } from "@storybook/react";
import { MonacoEditor } from "./MonacoEditor";

const meta: Meta<typeof MonacoEditor> = {
  title: "Editor/MonacoEditor",
  component: MonacoEditor,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="h-screen w-full">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const TypeScript: Story = {
  args: {
    path: "test.ts",
    value: "function sum(a: number, b: number): number {\n  return a + b;\n}",
    onChange: () => {},
  },
};

export const CSS: Story = {
  args: {
    path: "styles.css",
    value: ".body {\n  background-color: #1e1e1e;\n  color: #fff;\n}",
    onChange: () => {},
  },
};
