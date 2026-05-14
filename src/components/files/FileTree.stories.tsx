import type { Meta, StoryObj } from "@storybook/react";
import { FileTree } from "./FileTree";
import { useProjectStore } from "@/stores/project";
import { useEffect } from "react";

const meta: Meta<typeof FileTree> = {
  title: "Files/FileTree",
  component: FileTree,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="bg-[#1e1e1e] p-4 max-w-sm border border-[#333] h-[500px] overflow-y-auto">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

const sampleNodes = [
  {
    name: "src",
    path: "/project/src",
    isDir: true,
    type: "directory" as const,
    children: [
      { name: "App.tsx", path: "/project/src/App.tsx", isDir: false, type: "file" as const },
      { name: "index.css", path: "/project/src/index.css", isDir: false, type: "file" as const },
      {
        name: "components",
        path: "/project/src/components",
        isDir: true,
        type: "directory" as const,
        children: [
          { name: "Button.tsx", path: "/project/src/components/Button.tsx", isDir: false, type: "file" as const }
        ]
      }
    ]
  },
  { name: "package.json", path: "/project/package.json", isDir: false, type: "file" as const },
  { name: "README.md", path: "/project/README.md", isDir: false, type: "file" as const },
];

export const Default: Story = {
  args: {
    nodes: sampleNodes,
  },
  decorators: [
    (Story) => {
      useEffect(() => {
        useProjectStore.setState({ activeTab: "/project/src/App.tsx" });
      }, []);
      return <Story />;
    },
  ],
};

export const Empty: Story = {
  args: {
    nodes: [],
  },
};
