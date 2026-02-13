// Auto-refresh helper for development
if (process.env.NODE_ENV === 'development') {
  let lastModified = Date.now();
  
  setInterval(async () => {
    try {
      const response = await fetch('/api/health-check');
      if (response.ok) {
        const data = await response.json();
        if (data.timestamp > lastModified) {
          lastModified = data.timestamp;
          // Hard refresh
          window.location.reload(true);
        }
      }
    } catch (error) {
      // Server might be restarting
    }
  }, 2000);
}
