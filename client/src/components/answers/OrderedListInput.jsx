import { useState, useEffect, forwardRef } from 'react';

/**
 * Ordered List Input Component
 * Drag and drop interface for arranging items in correct order
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
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Shuffle and set items when question changes
  useEffect(() => {
    if (items.length > 0) {
      // Shuffle items for initial display
      const shuffled = [...items].sort(() => Math.random() - 0.5);
      setOrderedItems(shuffled);
    }
  }, [question?.id, items]);

  // Handle drag start
  const handleDragStart = (e, index) => {
    if (hasSubmitted || disabled) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.outerHTML);
  };

  // Handle drag over
  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (hasSubmitted || disabled) return;
    if (draggedIndex === index) return;
    setDragOverIndex(index);
  };

  // Handle drop
  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (hasSubmitted || disabled) return;
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const newItems = [...orderedItems];
    const [draggedItem] = newItems.splice(draggedIndex, 1);
    newItems.splice(dropIndex, 0, draggedItem);
    setOrderedItems(newItems);
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Move item up
  const moveUp = (index) => {
    if (index === 0 || hasSubmitted || disabled) return;
    const newItems = [...orderedItems];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    setOrderedItems(newItems);
  };

  // Move item down
  const moveDown = (index) => {
    if (index === orderedItems.length - 1 || hasSubmitted || disabled) return;
    const newItems = [...orderedItems];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    setOrderedItems(newItems);
  };

  // Handle submit
  const handleSubmit = () => {
    if (hasSubmitted || disabled) return;
    const orderedIds = orderedItems.map(item => item.id);
    onSubmit(orderedIds);
  };

  // Get item status for results display
  const getItemStatus = (item, index) => {
    if (!revealResults || !correctOrder) return null;
    
    const correctIndex = correctOrder.indexOf(item.id);
    if (correctIndex === -1) return 'unknown';
    
    // Check if item is in correct position
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

  const containerClass = ['ordered-list-container'];
  if (hasSubmitted) containerClass.push('submitted');
  if (revealResults) containerClass.push('revealed');

  return (
    <div className={containerClass.join(' ')}>
      {/* Instructions */}
      <div className="ordered-list-instructions">
        {revealResults 
          ? `Score: ${score?.correct}/${score?.total} in correct position`
          : 'Drag items or use arrows to arrange in correct order'}
      </div>

      {/* Sortable list */}
      <ul className="ordered-list">
        {orderedItems.map((item, index) => {
          const status = getItemStatus(item, index);
          const itemClass = ['ordered-list-item'];
          if (draggedIndex === index) itemClass.push('dragging');
          if (dragOverIndex === index) itemClass.push('drag-over');
          if (status) itemClass.push(`status-${status}`);

          return (
            <li
              key={item.id}
              className={itemClass.join(' ')}
              draggable={!hasSubmitted && !disabled}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
            >
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
      <button 
        className="secondary-btn ordered-list-submit" 
        onClick={handleSubmit}
        disabled={disabled || hasSubmitted || orderedItems.length === 0}
      >
        {hasSubmitted ? 'Submitted' : 'Submit Order'}
      </button>
    </div>
  );
});

export default OrderedListInput;
