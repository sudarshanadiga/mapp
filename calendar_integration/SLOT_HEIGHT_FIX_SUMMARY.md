# Slot Height and Border Alignment Fix

## Problem
The calendar had inconsistent slot heights and 1px drift between the time axis and grid due to:
- Borders not being included in the height calculations
- Inconsistent use of CSS variables for heights
- Gradient patterns not aligning with actual slot dimensions

## Solution Implemented

### 1. CSS Variable Consistency
- **File**: `static/css/components/calendar-grid.css`
- **Changes**: 
  - Maintained `--fc-slot-h: 50px` CSS variable
  - Updated all slot heights to use `var(--fc-slot-h)` instead of hardcoded values
  - Applied to major slots, minor slots, and slot labels

### 2. Border-Box Sizing
- **Files**: 
  - `static/css/components/calendar-grid.css`
  - `static/css/components/sleep-toggles.css`
- **Changes**:
  - Added `box-sizing: border-box !important` to all slot rows (major and minor)
  - Added `box-sizing: border-box !important` to slot labels
  - Added `box-sizing: border-box !important` to sleep-toggle rows and cells
  - This ensures borders are included in height calculations, eliminating the 1px drift

### 3. Gradient Pattern Alignment
- **File**: `static/css/components/calendar-grid.css`
- **Changes**:
  - Updated gradient patterns to use CSS variables: `var(--fc-slot-h)`
  - Changed gradient calculation to `calc(var(--fc-slot-h) + 1px)` for border alignment
  - Updated both main gradient and fallback gradient in `@supports` block

### 4. Dynamic Height Adjustment
- **File**: `static/js/utils/slot-height-adjuster.js` (new)
- **Features**:
  - `adjustSlotHeight(calendar)`: Measures actual slot height and updates CSS variable
  - `initializeSlotHeightAdjustment(calendar)`: Sets up automatic adjustment on view changes and window resize
  - `setSlotHeight(height)`: Manually set slot height
  - `resetSlotHeight()`: Reset to default 50px

### 5. Integration
- **File**: `static/js/core.js`
- **Changes**:
  - Added import and initialization of slot height adjuster
  - Integrated with existing calendar initialization flow

## Benefits

1. **Eliminates 1px Drift**: Border-box sizing ensures borders are part of the height calculation
2. **Consistent Heights**: All elements use the same CSS variable for height
3. **Dynamic Adjustment**: Can adapt to different slot durations or view changes
4. **Maintainable**: Single CSS variable controls all slot heights
5. **Future-Proof**: Easy to adjust slot heights by changing one variable

## Testing

A test file was created at `test_slot_height_fix.html` that allows:
- Manual testing of different slot heights
- Verification of border alignment
- Measurement of actual rendered heights
- Testing of sleep-toggle alignment

## Usage

The fix is automatically applied when the calendar loads. For manual adjustments:

```javascript
// Set custom slot height
setSlotHeight(60);

// Reset to default
resetSlotHeight();

// Measure actual height
const slotElement = document.querySelector('.fc-timegrid-slot');
const height = slotElement.offsetHeight;
```

## Browser Compatibility

- Uses `box-sizing: border-box` (supported in all modern browsers)
- Uses CSS custom properties (supported in all modern browsers)
- Includes fallback gradient patterns for older browsers
- Uses `calc()` for dynamic calculations (supported in all modern browsers) 