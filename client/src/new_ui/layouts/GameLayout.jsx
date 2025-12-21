import React, { useState } from 'react';
import './layout.css';
import { theme } from '../theme';

export default function GameLayout({ 
  topBar, 
  bottomBar, 
  leftSidebar, 
  rightSidebar, 
  children,
  isSettingsOpen
}) {
  const style = {
    '--bg-color': theme.colors.background,
    '--text-color': theme.colors.text,
    '--border-color': theme.colors.border,
    '--font-family': theme.typography.fontFamily,
  };

  return (
    <div className="game-layout" style={style}>
      <div className="layout-top">
        {topBar}
      </div>
      
      <div className={`layout-left ${isSettingsOpen ? 'open' : ''}`}>
        {leftSidebar}
      </div>
      
      <main className="layout-main">
        {children}
      </main>
      
      <div className="layout-right">
        {rightSidebar}
      </div>
      
      <div className="layout-bottom">
        {bottomBar}
      </div>
    </div>
  );
}
