import { useStore } from 'zustand';
import { coreStore } from '../../core/state/coreStore';

export function StatusbarSlot() {
  const viewsRecord = useStore(coreStore, (state) => state.views);
  
  const views = Object.values(viewsRecord)
    .filter(v => v.target === 'statusbar')
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  if (views.length === 0) return null;

  return (
    <div className="flex items-center h-8 px-4 bg-obsidian-950 text-xs text-slate-400 border-t border-white/5">
      {views.map(View => (
        <View.component key={View.id} />
      ))}
    </div>
  );
}
