import React from 'react';

interface ToolbarAction {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}

interface BottomToolbarProps {
  actions: ToolbarAction[];
}

const BottomToolbar: React.FC<BottomToolbarProps> = ({ actions }) => {
  if (!actions.length) {
    return null;
  }

  const columnStyle: React.CSSProperties = {
    gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))`,
  };

  return (
    <nav
      className="fixed inset-x-6 bottom-0 z-40"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
    >
      <div
        className="rounded-2xl border border-[#7CB7FF]/30 bg-[#E2F0FF]/90 backdrop-blur-xl px-3 pt-2 shadow-[0_12px_24px_rgba(124,183,255,0.28)]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
      >
        <div className="grid gap-2" style={columnStyle}>
          {actions.map(action => (
            <button
              key={action.key}
              type="button"
              onClick={action.onClick}
              aria-pressed={action.active}
              className={`group flex flex-col items-center gap-1.5 rounded-xl px-2 py-2 transition text-center ${
                action.active
                  ? 'bg-white shadow-md shadow-[#7CB7FF]/25'
                  : 'bg-white/40 hover:bg-white/70'
              }`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${
                  action.active
                    ? 'bg-[#7CB7FF] text-white'
                    : 'bg-[#EBF5FF] text-[#2A3B5F] group-hover:bg-[#7CB7FF]/90 group-hover:text-white'
                }`}
              >
                {action.icon}
              </span>
              <span className={`text-xs font-semibold ${action.active ? 'text-[#1C2B4B]' : 'text-[#1C2B4B]/80'}`}>
                {action.label}
              </span>
              <span className="text-[10px] text-[#1C2B4B]/60 leading-tight">{action.description}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default BottomToolbar;
