import type { Meta, StoryObj } from "@storybook/react";
import { ResizeHandle } from "./ResizeHandle";

const meta: Meta<typeof ResizeHandle> = {
  title: "Layout/ResizeHandle",
  component: ResizeHandle,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    orientation: {
      control: "radio",
      options: ["horizontal", "vertical"],
    },
    onResize: { action: "resized" },
  },
  decorators: [
    (Story, context) => (
      <div
        style={{
          width: "300px",
          height: "300px",
          backgroundColor: "#1e1e1e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: context.args.orientation === "horizontal" ? "row" : "column",
        }}
      >
        <div style={{ flex: 1, backgroundColor: "#2d2d2d" }}>Panel 1</div>
        <Story />
        <div style={{ flex: 1, backgroundColor: "#3c3c3c" }}>Panel 2</div>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  args: {
    orientation: "horizontal",
  },
};

export const Vertical: Story = {
  args: {
    orientation: "vertical",
  },
};
