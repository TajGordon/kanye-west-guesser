export const theme = {
  colors: {
    background: '#ffffff',
    surface: '#ffffff',
    text: '#000000',
    border: '#000000',
    
    primary: '#000000', // Main action color
    secondary: '#eeeeee', // Secondary backgrounds
    
    accent: '#3b82f6', // Blue for general highlights
    success: '#22c55e', // Green for correct
    error: '#ef4444', // Red for wrong/errors
    warning: '#eab308', // Yellow
    
    highlight: '#f3f4f6', // Hover states
    
    // Specific UI elements
    timerBar: '#ef4444',
    playerHighlight: '#22c55e',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  borders: {
    thin: '1px solid #000000',
    thick: '2px solid #000000',
    radius: '0px', // Flat design
  },
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
    fontSize: {
      sm: '0.875rem',
      base: '1rem',
      lg: '1.25rem',
      xl: '1.5rem',
      xxl: '2rem',
    },
    fontWeight: {
      normal: 400,
      bold: 700,
    }
  }
};
