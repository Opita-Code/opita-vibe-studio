import { useStore } from 'zustand';
import { coreStore } from '../../core/state/coreStore';

export function EditorSlot() {
  const viewsRecord = useStore(coreStore, (state) => state.views);
  
  const views = Object.values(viewsRecord)
    .filter(v => v.target === 'editor')
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div className="flex flex-col flex-1 h-full min-w-0 relative">
      {views.map(View => (
        <View.component key={View.id} />
      ))}
      {views.length === 0 && (
        <div className="flex items-center justify-center h-full text-slate-500">
          <p>No editor extension loaded.</p>
        </div>
      )}
    </div>
  );
}
