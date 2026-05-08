const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export const checkBackendStatus = async () => {
  try {
    const response = await fetch(`${BACKEND_URL}/data`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Short timeout so status updates fast
      signal: AbortSignal.timeout(3000) 
    });
    
    if (response.ok) {
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
};
