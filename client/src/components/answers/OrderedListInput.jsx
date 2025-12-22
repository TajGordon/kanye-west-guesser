import { useState, useEffect, useRef, useCallback, forwardRef } from 'react';

/**
 * Ordered List Input Component
 * Drag and drop interface for arranging items in correct order
 * Uses pointer events for reliable cross-browser/device support
 */
const OrderedListInput = forwardRef(function OrderedListInput({
  question = null,
  items = [],                  // Array of { id, text } items to order
  onSubmit,                    // Callback with ordered IDs array
  disabled = false,
  hasSubmitted = false,
  submittedOrder = null,       // The order the user submitted
  revealResults = false,
  correctOrder = null          // The correct order of IDs
}, ref) {
  // Initialize with shuffled items
  const [orderedItems, setOrderedItems] = useState([]);
  const [dragState, setDragState] = useState({
    isDragging: false,
    draggedIndex: null,
    dragOverIndex: null,
    startY: 0,
    currentY: 0,
    pointerId: null
  });

  const listRef = useRef(null);
  const itemRefs = useRef([]);

  // Shuffle and set items when question changes
  useEffect(() => {
    if (items.length > 0) {
      // Shuffle items for initial display
      const shuffled = [...items].sort(() => Math.random() - 0.5);
      setOrderedItems(shuffled);
    }
  }, [question?.id, items.length]);

  // Handle pointer down - start drag
  const handlePointerDown = useCallback((e, index) => {
    if (hasSubmitted || disabled) return;
    
    // Prevent text selection and default behavior
    e.preventDefault();
    e.stopPropagation();
    
    // Capture pointer
    e.currentTarget.setPointerCapture(e.pointerId);
    
    setDragState({
      isDragging: true,
      draggedIndex: index,
      dragOverIndex: index,
      startY: e.clientY,
      currentY: e.clientY,
      pointerId: e.pointerId
    });
  }, [hasSubmitted, disabled]);

  // Handle pointer move - during drag
  const handlePointerMove = useCallback((e) => {
    if (!dragState.isDragging || dragState.draggedIndex === null) return;
    
    const currentY = e.clientY;
    
    // Calculate which item we're over
    let newOverIndex = dragState.draggedIndex;
    
    if (listRef.current && itemRefs.current.length > 0) {
      for (let i = 0; i < itemRefs.current.length; i++) {
        const itemEl = itemRefs.current[i];
        if (!itemEl) continue;
        
        const rect = itemEl.getBoundingClientRect();
        const itemMiddle = rect.top + rect.height / 2;
        
        if (currentY < itemMiddle) {
          newOverIndex = i;
          break;
        }
        newOverIndex = i;
      }
    }
    
    // Clamp to valid range
    newOverIndex = Math.max(0, Math.min(newOverIndex, orderedItems.length - 1));
    
    setDragState(prev => ({
      ...prev,
      currentY,
      dragOverIndex: newOverIndex
    }));
  }, [dragState.isDragging, dragState.draggedIndex, orderedItems.length]);

  // Handle pointer up - end drag
  const handlePointerUp = useCallback((e) => {
    if (!dragState.isDragging) return;
    
    // Release pointer capture
    try {
      e.currentTarget?.releasePointerCapture?.(dragState.pointerId);
    } catch (err) {
      // Ignore capture errors
    }
    
    const { draggedIndex, dragOverIndex } = dragState;
    
    // Perform reorder if needed
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      setOrderedItems(prev => {
        const newItems = [...prev];
        const [draggedItem] = newItems.splice(draggedIndex, 1);
        newItems.splice(dragOverIndex, 0, draggedItem);
        return newItems;
      });
    }
    
    // Reset drag state
    setDragState({
      isDragging: false,
      draggedIndex: null,
      dragOverIndex: null,
      startY: 0,
      currentY: 0,
      pointerId: null
    });
  }, [dragState]);

  // Move item up (button)
  const moveUp = (index) => {
    if (index === 0 || hasSubmitted || disabled) return;
    setOrderedItems(prev => {
      const newItems = [...prev];
      [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
      return newItems;
    });
  };

  // Move item down (button)
  const moveDown = (index) => {
    if (index === orderedItems.length - 1 || hasSubmitted || disabled) return;
    setOrderedItems(prev => {
      const newItems = [...prev];
      [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
      return newItems;
    });
  };

  // Handle submit
  const handleSubmit = () => {
    if (hasSubmitted || disabled || !onSubmit) return;
    const orderedIds = orderedItems.map(item => item.id);
    onSubmit(orderedIds);
  };

  // Get item status for results display
  const getItemStatus = (item, index) => {
    if (!revealResults || !correctOrder) return null;
    
    const correctIndex = correctOrder.indexOf(item.id);
    if (correctIndex === -1) return 'unknown';
    
    // Check if item is in correct position based on submission
    const submittedIndex = submittedOrder?.indexOf(item.id) ?? index;
    if (submittedIndex === correctIndex) return 'correct';
    
    // How far off is it?
    const diff = Math.abs(submittedIndex - correctIndex);
    if (diff === 1) return 'close';
    return 'wrong';
  };

  // Calculate score when results revealed
  const getScore = () => {
    if (!revealResults || !correctOrder || !submittedOrder) return null;
    
    let correct = 0;
    for (let i = 0; i < correctOrder.length; i++) {
      if (submittedOrder[i] === correctOrder[i]) correct++;
    }
    return { correct, total: correctOrder.length };
  };

  const score = getScore();
  const { isDragging, draggedIndex, dragOverIndex, startY, currentY } = dragState;

  const containerClasses = [
    'ordered-list-container',
    hasSubmitted ? 'submitted' : '',
    revealResults ? 'revealed' : '',
    isDragging ? 'is-dragging' : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses}>
      {/* Instructions */}
      <div className="ordered-list-instructions">
        {revealResults 
          ? `Score: ${score?.correct}/${score?.total} in correct position`
          : hasSubmitted
            ? 'Order submitted! Waiting for results...'
            : 'Drag items or use arrows to arrange in correct order'}
      </div>

      {/* Sortable list */}
      <ul 
        ref={listRef}
        className={`ordered-list ${isDragging ? 'dragging-active' : ''}`}
      >
        {orderedItems.map((item, index) => {
          const status = getItemStatus(item, index);
          const isBeingDragged = isDragging && draggedIndex === index;
          const isDropTarget = isDragging && dragOverIndex === index && draggedIndex !== index;
          const isAboveTarget = isDragging && draggedIndex !== null && index < dragOverIndex && index >= draggedIndex;
          const isBelowTarget = isDragging && draggedIndex !== null && index > dragOverIndex && index <= draggedIndex;
          
          const itemClasses = [
            'ordered-list-item',
            isBeingDragged ? 'dragging' : '',
            isDropTarget ? 'drop-target' : '',
            isAboveTarget ? 'shift-up' : '',
            isBelowTarget ? 'shift-down' : '',
            status ? `status-${status}` : '',
            hasSubmitted ? 'submitted' : ''
          ].filter(Boolean).join(' ');

          // Calculate drag offset for the dragged item
          const dragOffset = isBeingDragged ? currentY - startY : 0;

          return (
            <li
              key={item.id}
              ref={el => itemRefs.current[index] = el}
              className={itemClasses}
              style={isBeingDragged ? {
                transform: `translateY(${dragOffset}px) scale(1.02)`,
                zIndex: 100,
                boxShadow: '0 8px 25px rgba(0,0,0,0.3)'
              } : undefined}
            >
              {/* Drag handle */}
              <span 
                className="item-drag-handle"
                onPointerDown={(e) => handlePointerDown(e, index)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{ touchAction: 'none' }}
              >
                ⠿
              </span>
              
              <span className="item-position">{index + 1}</span>
              <span className="item-text">{item.text}</span>
              
              {/* Arrow buttons for accessibility */}
              {!hasSubmitted && !disabled && (
                <div className="item-controls">
                  <button
                    type="button"
                    className="move-btn"
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="move-btn"
                    onClick={() => moveDown(index)}
                    disabled={index === orderedItems.length - 1}
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                </div>
              )}

              {/* Status indicator when results revealed */}
              {status && (
                <span className={`item-status ${status}`}>
                  {status === 'correct' ? '✓' : status === 'close' ? '~' : '✗'}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {/* Submit button */}
      {!hasSubmitted && !disabled && (
        <button 
          className="secondary-btn ordered-list-submit" 
          onClick={handleSubmit}
          disabled={disabled || hasSubmitted || orderedItems.length === 0}
        >
          Submit Order
        </button>
      )}
      
      {hasSubmitted && !revealResults && (
        <div className="ordered-list-submitted-indicator">
          ✓ Order submitted
        </div>
      )}
    </div>
  );
});

export default OrderedListInput;
