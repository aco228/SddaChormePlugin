// This script runs in the page context to bypass copy protection
(function() {
    'use strict';
    
    // Store original functions
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    const originalPreventDefault = Event.prototype.preventDefault;
    const originalStopPropagation = Event.prototype.stopPropagation;
    const originalStopImmediatePropagation = Event.prototype.stopImmediatePropagation;
    
    // Events to allow
    const allowedEvents = [
      'copy', 'cut', 'paste', 
      'contextmenu', 'selectstart', 
      'mousedown', 'mouseup', 'click',
      'keydown', 'keyup', 'keypress',
      'select', 'drag', 'dragstart'
    ];
    
    // Track blocked listeners
    const blockedListeners = new WeakMap();
    
    // Override addEventListener to track and selectively block
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      // If it's a protection event, mark it
      if (allowedEvents.includes(type.toLowerCase())) {
        if (!blockedListeners.has(this)) {
          blockedListeners.set(this, new Set());
        }
        blockedListeners.get(this).add(listener);
      }
      
      // Call original
      return originalAddEventListener.call(this, type, listener, options);
    };
    
    // Override preventDefault for copy-related events
    Event.prototype.preventDefault = function() {
      // Allow preventDefault for most events, but not for our allowed events
      if (allowedEvents.includes(this.type.toLowerCase())) {
        // Check if this is from a blocked listener
        const target = this.currentTarget || this.target;
        const listeners = blockedListeners.get(target);
        
        // If we're in a blocked listener context, don't prevent default
        if (listeners && listeners.size > 0) {
          console.log('[HTML Copier] Bypassing preventDefault for:', this.type);
          return;
        }
      }
      
      return originalPreventDefault.call(this);
    };
    
    // Override stopPropagation
    Event.prototype.stopPropagation = function() {
      if (allowedEvents.includes(this.type.toLowerCase())) {
        console.log('[HTML Copier] Bypassing stopPropagation for:', this.type);
        return;
      }
      return originalStopPropagation.call(this);
    };
    
    // Override stopImmediatePropagation
    Event.prototype.stopImmediatePropagation = function() {
      if (allowedEvents.includes(this.type.toLowerCase())) {
        console.log('[HTML Copier] Bypassing stopImmediatePropagation for:', this.type);
        return;
      }
      return originalStopImmediatePropagation.call(this);
    };
    
    // Remove existing copy protection attributes
    function removeProtectionAttributes() {
      document.querySelectorAll('[oncopy], [oncut], [onpaste], [onselectstart], [oncontextmenu]').forEach(el => {
        el.removeAttribute('oncopy');
        el.removeAttribute('oncut');
        el.removeAttribute('onpaste');
        el.removeAttribute('onselectstart');
        el.removeAttribute('oncontextmenu');
      });
      
      // Remove unselectable attributes
      document.querySelectorAll('[unselectable]').forEach(el => {
        el.removeAttribute('unselectable');
      });
      
      // Fix user-select CSS
      const style = document.createElement('style');
      style.textContent = `
        * {
          -webkit-user-select: text !important;
          -moz-user-select: text !important;
          -ms-user-select: text !important;
          user-select: text !important;
        }
      `;
      style.id = 'html-copier-override';
      
      // Remove existing override if present
      const existing = document.getElementById('html-copier-override');
      if (existing) existing.remove();
      
      document.head.appendChild(style);
    }
    
    // Run on load and periodically
    removeProtectionAttributes();
    
    // Watch for DOM changes
    const observer = new MutationObserver(removeProtectionAttributes);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['oncopy', 'oncut', 'onpaste', 'onselectstart', 'oncontextmenu', 'unselectable']
    });
    
    // Override document properties that might block copying
    try {
      Object.defineProperty(document, 'oncopy', {
        get: () => null,
        set: () => {},
        configurable: true
      });
      
      Object.defineProperty(document, 'oncut', {
        get: () => null,
        set: () => {},
        configurable: true
      });
      
      Object.defineProperty(document, 'onselectstart', {
        get: () => null,
        set: () => {},
        configurable: true
      });
      
      Object.defineProperty(document, 'oncontextmenu', {
        get: () => null,
        set: () => {},
        configurable: true
      });
    } catch (e) {
      console.log('[HTML Copier] Could not override document properties:', e);
    }
    
    console.log('[HTML Copier] Protection bypass active');
  })();