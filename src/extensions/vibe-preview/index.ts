import { Extension, ExtensionContext } from '../../core/types';
import { lazy } from 'react';

// Lazily load the Editor Panel (Sandpack)
const EditorPanelLazy = lazy(() => import('../../components/layout/EditorPanel').then(m => ({ default: m.EditorPanel })));

export const vibePreviewExtension: Extension = {
  id: 'opita.vibe-preview',
  
  activate: (context: ExtensionContext) => {
    console.log(`[Extension] Activating ${context.id}`);

    // Register the Editor View into the Editor Slot
    context.views.registerView({
      id: 'vibe.view.editor',
      title: 'Editor Preview',
      target: 'editor',
      component: EditorPanelLazy,
      order: 10
    });

    // Register Editor Commands
    context.commands.registerCommand({
      id: 'vibe.editor.format',
      title: 'Format Document',
      handler: async () => {
        console.log('Format document triggered');
      }
    });
  }
};
