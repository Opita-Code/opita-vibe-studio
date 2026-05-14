import type { Meta, StoryObj } from "@storybook/react";
import { ErrorBoundary } from "./ErrorBoundary";

const meta: Meta<typeof ErrorBoundary> = {
  title: "Core/ErrorBoundary",
  component: ErrorBoundary,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    name: "TestComponent",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Un componente que lanza un error intencionalmente
const BuggyComponent = () => {
  throw new Error("Este es un error simulado para probar el ErrorBoundary.");
  return <div>No debería renderizar</div>;
};

// Un componente normal
const GoodComponent = () => {
  return (
    <div className="p-4 bg-[#2d2d2d] text-white rounded shadow-lg border border-white/10">
      Componente renderizado correctamente.
    </div>
  );
};

export const Default: Story = {
  args: {
    children: <GoodComponent />,
  },
};

export const WithError: Story = {
  args: {
    children: <BuggyComponent />,
  },
};

export const CustomFallback: Story = {
  args: {
    children: <BuggyComponent />,
    fallback: (
      <div className="p-4 bg-red-900/50 border border-red-500 rounded text-red-200">
        <h3>Fallback Personalizado</h3>
        <p>Hubo un problema, pero este mensaje es personalizado.</p>
      </div>
    ),
  },
};
