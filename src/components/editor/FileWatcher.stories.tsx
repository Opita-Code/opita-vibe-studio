import type { Meta, StoryObj } from "@storybook/react";
import { FileWatcher } from "./FileWatcher";

const meta: Meta<typeof FileWatcher> = {
  title: "Editor/FileWatcher",
  component: FileWatcher,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="bg-[#1e1e1e] p-4 text-[#969696] text-sm text-center border border-dashed border-[#555] rounded">
        <p>Este es un componente invisible encargado de vigilar los cambios de archivos (File System Watcher).</p>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
