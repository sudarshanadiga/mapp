// LocalStorage keys
const STORAGE_KEYS = {
    SHOW_FUN: 'showFun',
    SHOW_WORK: 'showWork',
    SHOW_OTHER: 'showOther',
    USER_ID: 'pitext_user_id'
  };
  
  // Get filter preference from localStorage
  export function getFilterPreference(filterType, defaultValue) {
    const value = localStorage.getItem(STORAGE_KEYS[`SHOW_${filterType.toUpperCase()}`]);
    if (value === null) return defaultValue;
    return value === 'true';
  }
  
  // Set filter preference in localStorage
  export function setFilterPreference(filterType, value) {
    localStorage.setItem(STORAGE_KEYS[`SHOW_${filterType.toUpperCase()}`], value);
  }
  
  // Get user ID from localStorage
  export function getStoredUserId() {
    return localStorage.getItem(STORAGE_KEYS.USER_ID);
  }
  
  // Set user ID in localStorage
  export function setStoredUserId(userId) {
    if (userId) {
      localStorage.setItem(STORAGE_KEYS.USER_ID, userId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER_ID);
    }
  }
  
  // Initialize filter preferences with defaults
  export function initializeFilterPreferences() {
    return {
      showFun: getFilterPreference('fun', false),
      showWork: getFilterPreference('work', true),
      showOther: getFilterPreference('other', false)
    };
  }