import { Extension, ExtensionContext } from '../../core/types';
import { lazy } from 'react';

const ViewTabsLazy = lazy(() => import('../../components/layout/ViewTabs').then(m => ({ default: m.ViewTabs })));

export const vibeViewTabsExtension: Extension = {
  id: 'opita.vibe-viewtabs',
  
  activate: (context: ExtensionContext) => {
    // For now, we mount the tabs in the status bar slot as a hack until we have a top bar slot
    // Or we could create a TopBar slot later.
    context.views.registerView({
      id: 'vibe.view.tabs',
      title: 'View Tabs',
      target: 'statusbar',
      component: ViewTabsLazy,
      order: 0
    });
  }
};
