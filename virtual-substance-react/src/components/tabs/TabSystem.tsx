import React, { useState } from 'react';
import { Tab } from '../../types/types';

interface TabSystemProps {
  tabs: Tab[];
}

const TabSystem: React.FC<TabSystemProps> = ({ tabs }) => {
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0].id);

  const switchTab = (tabId: string) => {
    setActiveTabId(tabId);
  };

  const activeTab = tabs.find(tab => tab.id === activeTabId) || tabs[0];

  return (
    <div className="flex flex-col">
      <div className="flex justify-start items-center content-start menu-tab gap-1 mb-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`px-4 py-2 flex items-center gap-2 ${activeTabId === tab.id ? 'tab-selected' : ''}`}
            onClick={() => switchTab(tab.id)}
          >
            {tab.label}
            {tab.materialIcon && (
              <span className="material-icons text-sm">{tab.materialIcon}</span>
            )}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-8 px-3 min-w-[520px]">
        {activeTab.content}
      </div>
    </div>
  );
};

export default TabSystem;