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

    // 2. Mute and pause video and audio elements as they appear
    const pauseMedia = (el) => {
      if (el.tagName === 'VIDEO' || el.tagName === 'AUDIO') {
        el.muted = true;
        el.autoplay = false;
        el.pause();
        
        // Prevent autoplay by pausing on play event
        const onPlay = () => {
          el.muted = true;
          el.pause();
          el.removeEventListener('play', onPlay);
        };
        el.addEventListener('play', onPlay);
        
        // Also add a listener for canplay
        const onCanPlay = () => {
          el.muted = true;
          el.pause();
          el.removeEventListener('canplay', onCanPlay);
        };
        el.addEventListener('canplay', onCanPlay);
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

    // Also run a periodic check for 10 seconds to catch any delayed/JS-created players
    let checks = 0;
    const interval = setInterval(() => {
      document.querySelectorAll('video, audio').forEach(pauseMedia);
      checks++;
      if (checks > 50) { // 50 * 200ms = 10 seconds
        clearInterval(interval);
        observer.disconnect();
      }
    }, 200);
  }
})();
