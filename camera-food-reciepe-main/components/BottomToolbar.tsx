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

  return (
    <nav className="fixed inset-x-4 bottom-6 z-40">
      <div className="rounded-3xl border border-[#7CB7FF]/30 bg-[#E2F0FF]/90 backdrop-blur-xl px-4 py-3 shadow-[0_18px_40px_rgba(124,183,255,0.35)]">
        <div className="grid grid-cols-4 gap-3">
          {actions.map(action => (
            <button
              key={action.key}
              type="button"
              onClick={action.onClick}
              aria-pressed={action.active}
              className={`group flex flex-col items-center gap-2 rounded-2xl px-3 py-3 transition text-center ${
                action.active
                  ? 'bg-white shadow-lg shadow-[#7CB7FF]/30'
                  : 'bg-white/40 hover:bg-white/70'
              }`}
            >
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-2xl transition ${
                  action.active
                    ? 'bg-[#7CB7FF] text-white'
                    : 'bg-[#EBF5FF] text-[#2A3B5F] group-hover:bg-[#7CB7FF]/90 group-hover:text-white'
                }`}
              >
                {action.icon}
              </span>
              <span className={`text-sm font-semibold ${action.active ? 'text-[#1C2B4B]' : 'text-[#1C2B4B]/80'}`}>
                {action.label}
              </span>
              <span className="text-[11px] text-[#1C2B4B]/60 leading-tight">{action.description}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default BottomToolbar;
