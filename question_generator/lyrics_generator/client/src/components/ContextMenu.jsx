import React, { useEffect, useRef, useState } from 'react';
import './ContextMenu.css';

export default function ContextMenu({ x, y, onClose, actions }) {
  const menuRef = useRef(null);
  const [openSubmenu, setOpenSubmenu] = useState(null);
  const submenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && 
          submenuRef.current && !submenuRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleSubmenuClick = (action, idx) => {
    if (action.submenu) {
      setOpenSubmenu(openSubmenu === idx ? null : idx);
    }
  };

  return (
    <div 
      ref={menuRef}
      className="context-menu" 
      style={{ left: `${x}px`, top: `${y}px` }}
    >
      {actions.map((action, idx) => (
        action.divider ? (
          <div key={`divider-${idx}`} className="context-menu-divider" />
        ) : (
          <div key={idx} className={`context-menu-item-wrapper ${action.submenu ? 'has-submenu' : ''}`}>
            <button
              className={`context-menu-item ${action.disabled ? 'disabled' : ''}`}
              onClick={() => {
                if (!action.disabled) {
                  if (action.submenu) {
                    handleSubmenuClick(action, idx);
                  } else {
                    action.onClick();
                    onClose();
                  }
                }
              }}
              disabled={action.disabled}
            >
              {action.icon && <span className="context-menu-icon">{action.icon}</span>}
              <span className="context-menu-label">{action.label}</span>
              {action.submenu && <span className="context-menu-arrow">›</span>}
              {action.shortcut && <span className="context-menu-shortcut">{action.shortcut}</span>}
            </button>

            {action.submenu && openSubmenu === idx && (
              <div ref={submenuRef} className="context-submenu">
                {action.submenu.map((item, subIdx) => (
                  <button
                    key={subIdx}
                    className="context-menu-item submenu-item"
                    onClick={() => {
                      item.onClick();
                      setOpenSubmenu(null);
                      onClose();
                    }}
                  >
                    <span className="context-menu-label">{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      ))}
    </div>
  );
}
