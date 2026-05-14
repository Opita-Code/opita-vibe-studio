import type { Meta, StoryObj } from "@storybook/react";
import { LoginScreen } from "./LoginScreen";
import { useAuthStore } from "@/stores/auth";
import { useEffect } from "react";

const meta: Meta<typeof LoginScreen> = {
  title: "Auth/LoginScreen",
  component: LoginScreen,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="h-screen w-full bg-[#1e1e1e]">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  decorators: [
    (Story) => {
      useEffect(() => {
        useAuthStore.setState({ authMode: "unauthenticated", user: null, session: null });
      }, []);
      return <Story />;
    },
  ],
  args: {
    onAuthenticated: () => alert("¡Autenticado!"),
    onClose: () => alert("Cerrar presionado"),
  },
};
