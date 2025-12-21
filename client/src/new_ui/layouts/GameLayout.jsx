import React from 'react';

export default function GameLayout({ 
  topBar, 
  bottomBar, 
  leftSidebar, 
  rightSidebar, 
  children,
  isSettingsOpen
}) {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-black font-sans">
      {/* Top Bar */}
      <div className="z-10 shrink-0">
        {topBar}
      </div>
      
      {/* Middle Section */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar */}
        <div 
          className={`
            border-r border-black overflow-hidden transition-[width] duration-300 ease-in-out
            ${isSettingsOpen ? 'w-[300px]' : 'w-0'}
          `}
        >
          <div className="w-[300px] h-full">
            {leftSidebar}
          </div>
        </div>
        
        {/* Main Content */}
        <main className="flex-1 flex flex-col justify-center items-center overflow-y-auto relative p-4">
          {children}
        </main>
        
        {/* Right Sidebar */}
        <div className="w-[300px] border-l border-black overflow-y-auto shrink-0">
          {rightSidebar}
        </div>
      </div>
      
      {/* Bottom Bar */}
      <div className="z-10 shrink-0">
        {bottomBar}
      </div>
    </div>
  );
}
