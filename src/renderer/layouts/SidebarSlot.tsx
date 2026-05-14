import { useStore } from 'zustand';
import { coreStore } from '../../core/state/coreStore';

export function SidebarSlot() {
  const viewsRecord = useStore(coreStore, (state) => state.views);
  
  const views = Object.values(viewsRecord)
    .filter(v => v.target === 'sidebar')
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  if (views.length === 0) return null;

  return (
    <div className="flex flex-col h-full bg-obsidian-900/90 backdrop-blur-3xl border-r border-white/5">
      {views.map(View => (
        <View.component key={View.id} />
      ))}
    </div>
  );
}
