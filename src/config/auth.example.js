// Example authentication configuration
// Copy this file to auth.js and update with your actual values
// DO NOT commit auth.js to version control

export const AUTH_CONFIG = {
  // Collector mode password - change this to a secure password
  COLLECTOR_PASSWORD: import.meta.env.VITE_COLLECTOR_PASSWORD || 'your-secure-password-here',
  
  // Add other authentication settings here as needed
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes in milliseconds
};

// Helper function to validate password
export const validatePassword = (inputPassword) => {
  return inputPassword === AUTH_CONFIG.COLLECTOR_PASSWORD;
}; 