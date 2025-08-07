// Helper to format datetime for datetime-local input without timezone conversion
export function formatLocalDateTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
  
  // Helper to pad numbers for date formatting
  export function pad(n) {
    return n.toString().padStart(2, '0');
  }
  
  // Helper to format date for calendar operations
  export function formatDateForCalendar(date) {
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  
  // Helper to get date from various formats
  export function parseEventDate(dateValue) {
    if (typeof dateValue === 'string' && !dateValue.includes('T')) {
      return dateValue + 'T00:00:00';
    }
    return dateValue;
  }