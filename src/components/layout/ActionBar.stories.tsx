import type { Meta, StoryObj } from "@storybook/react";
import { ActionBar } from "./ActionBar";
import { useUIStore } from "@/stores/ui";
import { useEffect } from "react";

const meta: Meta<typeof ActionBar> = {
  title: "Layout/ActionBar",
  component: ActionBar,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => {
      // Forzar visibilidad para la historia
      useEffect(() => {
        useUIStore.setState({ actionBarVisible: true });
      }, []);
      return (
        <div className="h-screen bg-[#1e1e1e]">
          <Story />
        </div>
      );
    },
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onLogin: () => alert("Login presionado"),
  },
};
