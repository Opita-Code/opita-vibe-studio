import type { Meta, StoryObj } from "@storybook/react";
import { EditorPanel } from "./EditorPanel";
import { useUIStore } from "@/stores/ui";
import { useProjectStore } from "@/stores/project";
import { useEffect } from "react";

const meta: Meta<typeof EditorPanel> = {
  title: "Layout/EditorPanel",
  component: EditorPanel,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="h-screen w-full bg-[#1e1e1e] flex">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const EditorView: Story = {
  decorators: [
    (Story) => {
      useEffect(() => {
        useUIStore.setState({ activeView: "editor", explorerVisible: true });
        useProjectStore.setState({ 
          activeWorkspaceId: "/mock/project",
          openTabs: ["/mock/project/src/App.tsx", "/mock/project/src/index.css"],
          activeTab: "/mock/project/src/App.tsx",
          fileContents: {
            "/mock/project/src/App.tsx": "export default function App() {\n  return <div>Hello World</div>;\n}",
            "/mock/project/src/index.css": "body {\n  margin: 0;\n}",
          },
        });
      }, []);
      return <Story />;
    },
  ],
};

export const PreviewView: Story = {
  decorators: [
    (Story) => {
      useEffect(() => {
        useUIStore.setState({ activeView: "preview" });
        useProjectStore.setState({
          activeTab: "/index.html",
          fileContents: { "/index.html": "<h1>Vista Previa</h1><p>Prueba de preview.</p>" }
        });
      }, []);
      return <Story />;
    },
  ],
};

export const NoProjectOpened: Story = {
  decorators: [
    (Story) => {
      useEffect(() => {
        useUIStore.setState({ activeView: "editor", explorerVisible: true });
        useProjectStore.setState({ activeWorkspaceId: null, openTabs: [], activeTab: null, fileContents: {} });
      }, []);
      return <Story />;
    },
  ],
};
