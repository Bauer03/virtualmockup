import React from 'react';
import { Tab } from '../../types/types';

interface TabContentProps {
  tab: Tab;
}

const TabContent: React.FC<TabContentProps> = ({ tab }) => {
  return (
    <div className="py-4">
      {tab.content}
    </div>
  );
};

export default TabContent;