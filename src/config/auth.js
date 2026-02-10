// Authentication configuration
// This file is safe to commit as it uses environment variables
// Set VITE_COLLECTOR_PASSWORD in your environment for production

export const AUTH_CONFIG = {
  // Collector mode password - uses environment variable or fallback
  COLLECTOR_PASSWORD: import.meta.env.VITE_COLLECTOR_PASSWORD || '',

  // Add other authentication settings here as needed
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes in milliseconds
};

// Helper function to validate password
export const validatePassword = (inputPassword) => {
  return inputPassword === AUTH_CONFIG.COLLECTOR_PASSWORD;
};
