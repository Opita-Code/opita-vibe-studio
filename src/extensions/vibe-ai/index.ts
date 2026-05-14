import { Extension, ExtensionContext } from '../../core/types';
import { lazy } from 'react';

// We lazily load the heavy ChatPanel so it doesn't block core boot
const ChatPanelLazy = lazy(() => import('../../components/layout/ChatPanel').then(m => ({ default: m.ChatPanel })));

export const vibeAIExtension: Extension = {
  id: 'opita.vibe-ai',
  
  activate: (context: ExtensionContext) => {
    console.log(`[Extension] Activating ${context.id}`);

    // Register the Chat View into the Sidebar Slot
    context.views.registerView({
      id: 'vibe.view.chat',
      title: 'Vibe AI',
      target: 'sidebar',
      component: ChatPanelLazy,
      order: 10
    });

    // Register AI Commands
    context.commands.registerCommand({
      id: 'vibe.ai.explain',
      title: 'Explain Code',
      handler: async (code: string) => {
        console.log('AI Explain triggered for:', code);
        // This will hook into the pipeline later
      }
    });
  }
};
