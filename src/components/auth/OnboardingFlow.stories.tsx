import type { Meta, StoryObj } from "@storybook/react";
import { OnboardingFlow } from "./OnboardingFlow";

const meta: Meta<typeof OnboardingFlow> = {
  title: "Auth/OnboardingFlow",
  component: OnboardingFlow,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="h-screen w-full bg-[#0A0B0E]">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onLogin: () => alert("Botón de Login presionado"),
  },
};
