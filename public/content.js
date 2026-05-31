(function() {
  if (window.location.hash.includes('outliner-paused')) {
    console.log('[Outliner] Restored tab detected. Disabling autoplay and pausing media.');
    
    // 1. Remove the hash from address bar so it's clean for the user
    try {
      const cleanUrl = window.location.href.split('#')[0];
      window.history.replaceState(null, "", cleanUrl);
    } catch (e) {
      console.warn('[Outliner] Failed to clean URL hash:', e);
    }

    const elementsToProtect = new Set();

    const onPlay = (e) => {
      e.target.autoplay = false;
      e.target.pause();
    };

    const onCanPlay = (e) => {
      e.target.autoplay = false;
      e.target.pause();
    };

    // Pause video and audio elements as they appear
    const pauseMedia = (el) => {
      if (el.tagName === 'VIDEO' || el.tagName === 'AUDIO') {
        el.autoplay = false;
        el.pause();
        
        if (!elementsToProtect.has(el)) {
          elementsToProtect.add(el);
          el.addEventListener('play', onPlay);
          el.addEventListener('canplay', onCanPlay);
        }
      }
    };

    // Check existing
    document.querySelectorAll('video, audio').forEach(pauseMedia);

    // Watch for new elements
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'VIDEO' || node.tagName === 'AUDIO') {
              pauseMedia(node);
            }
            node.querySelectorAll('video, audio').forEach(pauseMedia);
          }
        });
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    // Cleanup function when user interacts or after timeout
    const cleanupAutoplayProtection = () => {
      clearInterval(interval);
      observer.disconnect();
      
      elementsToProtect.forEach(el => {
        try {
          el.removeEventListener('play', onPlay);
          el.removeEventListener('canplay', onCanPlay);
        } catch (e) {}
      });
      elementsToProtect.clear();

      window.removeEventListener('mousedown', cleanupAutoplayProtection, true);
      window.removeEventListener('keydown', cleanupAutoplayProtection, true);
      window.removeEventListener('touchstart', cleanupAutoplayProtection, true);
      console.log('[Outliner] Autoplay protection cleared due to user interaction or timeout.');
    };

    // Run a periodic check for 10 seconds to catch delayed elements
    let checks = 0;
    const interval = setInterval(() => {
      document.querySelectorAll('video, audio').forEach(pauseMedia);
      checks++;
      if (checks > 50) { // 50 * 200ms = 10 seconds
        cleanupAutoplayProtection();
      }
    }, 200);

    // Listen for any user interaction to disable autoplay protection instantly
    window.addEventListener('mousedown', cleanupAutoplayProtection, true);
    window.addEventListener('keydown', cleanupAutoplayProtection, true);
    window.addEventListener('touchstart', cleanupAutoplayProtection, true);
  }
})();
