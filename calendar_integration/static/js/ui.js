/* Very small pub-sub modal helper */

const listeners = {};

function emit (evt, payload) {
  (listeners[evt] || []).forEach(fn => fn(payload));
}

export const ui = {
  on (evt, fn) {
    listeners[evt] = listeners[evt] || [];
    listeners[evt].push(fn);
  },

  toastError (err) {
    console.error(err);
    alert(err.message || 'An error occurred');
  },

  /* -------------------------------------------------------------- */
  /* Modal handling                                                 */
  /* -------------------------------------------------------------- */
  openEventModal (defaults = {}) {
    console.log('Opening event modal with defaults:', defaults);
    const modal = document.getElementById('event-modal');
    const form  = modal?.querySelector('form');
    const echoIndicator = document.getElementById('echo-indicator');
    const echoBtn = modal?.querySelector('#echo-event-btn');
    
    // Validate that required elements exist
    if (!modal || !form) {
      console.error('Modal or form not found:', { modal: !!modal, form: !!form });
      alert('Event modal could not be loaded. Please refresh the page and try again.');
      return;
    }
    
    console.log('Modal elements found:', {
      modal: !!modal,
      form: !!form,
      echoIndicator: !!echoIndicator,
      echoBtn: !!echoBtn
    });

    // Helper to update echo indicator (define early to avoid reference errors)
    const updateEchoIndicator = (hasEcho) => {
      if (echoIndicator) {
        if (hasEcho) {
          echoIndicator.classList.add('active');
        } else {
          echoIndicator.classList.remove('active');
        }
      }
    };

    // Reset form
    form.reset();
    
    // Safely set form values with null checks
    if (form.event_id) form.event_id.value = defaults.event_id ?? '';
    if (form.title) form.title.value = defaults.title ?? '';
    if (form.description) form.description.value = defaults.description ?? '';
    if (form.location) form.location.value = defaults.location ?? '';
    if (form.start_time) form.start_time.value = defaults.start_time ?? '';
    if (form.duration_minutes) form.duration_minutes.value = defaults.duration_minutes ?? 30;

    // Set eventType dropdown value if present
    if (form.eventType) {
      form.eventType.value = defaults.eventType || 'other';
    }

    // Always reset modal to Details tab and clear echo content
    const flowchartDiv = document.getElementById('echo-flowchart');
    if (flowchartDiv) flowchartDiv.innerHTML = '';

    // Switch to Details tab
    const detailsTab = document.querySelector('[data-tab="details"]');
    if (detailsTab) detailsTab.click();

    modal.showModal();
    
    // Ensure modal is properly centered after opening
    setTimeout(() => {
      const modalRect = modal.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Check if modal is not centered and force centering
      if (Math.abs(modalRect.left + modalRect.width / 2 - viewportWidth / 2) > 10 ||
          Math.abs(modalRect.top + modalRect.height / 2 - viewportHeight / 2) > 10) {
        console.log('Modal not centered, forcing centering...');
        modal.style.position = 'fixed';
        modal.style.top = '50%';
        modal.style.left = '50%';
        modal.style.transform = 'translate(-50%, -50%)';
        modal.style.margin = '0';
      }
    }, 10);

    // Improved outside click: close only if click is on the backdrop
    function outside (e) {
      if (e.target === modal) close();
    }
    function close () {
      modal.removeEventListener('click', outside);
      modal.close();
    }
    modal.addEventListener('click', outside);

    // Submit
    form.onsubmit = e => {
      e.preventDefault();
      // Prevent multiple submissions - look for submit button in modal since it's outside the form
      const submitBtn = modal.querySelector('[type="submit"]');
      if (submitBtn && submitBtn.disabled) return;
      const payload = Object.fromEntries(new FormData(form));
      payload.duration_minutes = Number(payload.duration_minutes);
      // Add eventType to payload
      if (form.eventType) payload.eventType = form.eventType.value;
      // Ensure eventType defaults to "other" if not specified
      if (!payload.eventType) {
        payload.eventType = 'other';
      }
      // Set color based on eventType
      if (payload.eventType === 'fun') {
        payload.color = '#e91e63';
      } else if (payload.eventType === 'work') {
        payload.color = '#2196f3';
      } else if (payload.eventType === 'other') {
        payload.color = '#43a047';
      }
      // Fun event validation
      if (payload.eventType === 'fun') {
        const start = new Date(payload.start_time);
        const end = new Date(start.getTime() + payload.duration_minutes * 60000);
        const duration = (end - start) / (1000 * 60 * 60);
        if (duration > 8) {
          alert('Fun activity duration cannot be more than 8 hours');
          return false;
        }
      }
      emit('event:saved', payload);
      // Don't close here - let core.js handle it after successful save
    };

    // Delete (visible only in edit mode)
    const delBtn = modal.querySelector('.delete');
    delBtn.style.display = defaults.event_id ? 'inline-block' : 'none';
    delBtn.onclick = () => {
      emit('event:deleted', defaults.event_id);
      close();
    };

    // Echo this! button logic
    const resetBtn = document.getElementById('echo-reset-btn');

    // Ensure clean button state
    if (echoBtn) {
      echoBtn.textContent = 'Echo this!';
      echoBtn.disabled = false;
    }

    // Set up reset button functionality first (always available)
    if (resetBtn) {
      resetBtn.onclick = () => {
        console.log('Reset button clicked');
        if (flowchartDiv) {
          flowchartDiv.innerHTML = '';
          console.log('Flowchart cleared');
        }
        // Update indicator
        updateEchoIndicator(false);
        // Switch back to Details tab
        const detailsTab = document.querySelector('[data-tab="details"]');
        if (detailsTab) {
          detailsTab.click();
        }
      };
    }

    // Check if this event or its related events have a flowchart
    const checkForFlowchart = () => {
      // For new events (no event_id), never show echo indicator
      if (!defaults.event_id) {
        return null;
      }
      
      // First check if current event has a flowchart (non-empty string)
      if (defaults.flowchart && defaults.flowchart.trim().length > 0) {
        return defaults.flowchart;
      }
      
      // If not, check if this is an echo event and find its flowchart
      if (defaults.type === 'echo' && window.calendar) {
        const allEvents = window.calendar.getEvents();
        for (const event of allEvents) {
          const props = event.extendedProps;
          if (props.flowchart && props.flowchart.trim().length > 0 && 
              props.echo_event_ids && 
              props.echo_event_ids.includes(defaults.event_id)) {
            return props.flowchart;
          }
        }
      }
      return null;
    };

    const existingFlowchart = checkForFlowchart();
    // Update indicator based on whether flowchart exists
    // Only show if there's actually a non-empty flowchart
    updateEchoIndicator(existingFlowchart && existingFlowchart.trim().length > 0);

    // Auto-render existing flowchart when modal opens
    if (existingFlowchart && flowchartDiv) {
      // Automatically render the flowchart in the Echo tab
      (async () => {
        try {
          let mermaidCode = existingFlowchart;
          const cleanedCode = mermaidCode
            .replace(/```mermaid[\s\S]*?%%/i, '%%')
            .replace(/```$/m, '')
            .replace(/click D[0-9]+ "javascript:[^"]*"/g, '')
            .replace(/\n\s*class\s+D\d+\s+[^\n]*/g, '')
            .trim();
          
          if (typeof window.mermaid !== 'undefined' && window.mermaid.render) {
            const { svg } = await window.mermaid.render('existing-echo-' + Date.now(), cleanedCode);
            flowchartDiv.innerHTML = svg;
          }
        } catch (err) {
          console.error('Failed to auto-render existing flowchart:', err);
        }
      })();
    }

    if (defaults.event_id) {
      console.log('Event has ID:', defaults.event_id, 'Type:', defaults.type, 'Has flowchart:', !!existingFlowchart);
      if (existingFlowchart) {
        // Event already has a flowchart - hide the echo button since it auto-renders
        echoBtn.style.display = 'none';
        console.log('Echo button hidden - event has existing flowchart');
      } else if (defaults.type !== 'echo') {
        // Original event without flowchart - can generate echo
        echoBtn.style.display = 'inline-block';
        echoBtn.disabled = false;
        echoBtn.textContent = 'Echo this!';
        console.log('Echo button shown and enabled');
        echoBtn.onclick = async () => {
          console.log('Echo button clicked!');
          echoBtn.disabled = true;
          echoBtn.textContent = 'Generating...';
          try {
            const userId = document.querySelector('meta[name="user-id"]').content || 'default_user';
            const res = await fetch(`/calendar/events/${defaults.event_id}/echo?user_id=${encodeURIComponent(userId)}`, { method: 'POST' });
            if (!res.ok) throw new Error('Failed to generate follow-ups');
            const data = await res.json();
            
            // Reload events to get the updated flowchart data
            if (window.loadEvents && window.calendar) {
              await window.loadEvents(window.calendar, userId);
            }
            
            // Show the flowchart
            let mermaidCode = data.data?.mermaid || '';
            if (mermaidCode) {
              const cleaned = mermaidCode
                .replace(/```mermaid[\s\S]*?%%/i, '%%')
                .replace(/```$/m, '')
                .replace(/click D[0-9]+ "javascript:[^"]*"/g, '')
                .trim();
              
              // Set up gotoDate function with title matching for click handlers
              window.gotoDateWithTitle = function(dateStr, eventTitle) {
                if (window.calendar) {
                  try {
                    const date = new Date(dateStr);
                    window.calendar.gotoDate(date);
                    // Find and open the event on this date with matching title
                    const allEvents = window.calendar.getEvents();
                    let foundEvent = null;
                    for (const event of allEvents) {
                      const eventDate = event.start;
                      // Check if this event is on the clicked date
                      if (eventDate && eventDate.toISOString().startsWith(dateStr)) {
                        // If we have a title to match, check it
                        if (eventTitle && event.title === eventTitle) {
                          foundEvent = event;
                          break;
                        } else if (!eventTitle && !foundEvent) {
                          // If no title specified, take the first event on this date
                          foundEvent = event;
                        }
                      }
                    }
                    if (foundEvent) {
                      // Trigger event click to open modal with correct event details
                      const eventClickInfo = {
                        event: foundEvent,
                        el: null,
                        jsEvent: null,
                        view: window.calendar.view
                      };
                      // Call the eventClick handler directly
                      const eventClickHandler = window.calendar.getOption('eventClick');
                      if (eventClickHandler) {
                        eventClickHandler(eventClickInfo);
                      }
                    }
                  } catch (e) {
                    console.error('Invalid date or event lookup:', e);
                  }
                }
              };
              // Keep the simple version for backward compatibility
              window.gotoDate = function(dateStr) {
                window.gotoDateWithTitle(dateStr, null);
              };
              
              // Switch to Echo tab first
              document.querySelector('[data-tab="echo"]').click();
              try {
                const finalCode = cleaned
                  .replace(/\n\s*click\s+D[0-9]+\s+"[^"]*"/g, '')
                  .replace(/\n\s*class\s+D\d+\s+[^\n]*/g, '');
                if (typeof window.mermaid !== 'undefined' && window.mermaid.render) {
                  const { svg } = await window.mermaid.render('new-echo-' + Date.now(), finalCode);
                  flowchartDiv.innerHTML = svg;
                }
              } catch (mermaidError) {
                console.error('Mermaid render failed:', mermaidError);
                flowchartDiv.innerHTML = `
                  <div style="color: #dc3545; padding: 20px; text-align: center;">
                    <div>Flowchart rendering error - please try again.</div>
                    <div style="font-size: 0.9em; margin-top: 10px;">Error: ${mermaidError.message}</div>
                  </div>`;
              }
            }
            
            // Update indicator, reset button text and hide it after successful generation
            updateEchoIndicator(true);
            echoBtn.textContent = 'Echo this!';
            echoBtn.disabled = false;
            echoBtn.style.display = 'none';
          } catch (err) {
            console.error('Echo generation error:', err);
            alert('Failed to generate follow-ups: ' + (err.message || err));
            echoBtn.disabled = false;
            echoBtn.textContent = 'Echo this!';
          }
        };
      } else {
        // Echo event - hide the button
        echoBtn.style.display = 'none';
      }
    } else {
      // New event - hide echo button
      echoBtn.style.display = 'none';
      if (flowchartDiv) flowchartDiv.innerHTML = '';
    }

    // Global cache for last generated flowchart and associated event IDs
    window.lastEchoFlowchart = {
      eventId: null,
      mermaid: null,
      echoEventIds: [],
      allEventData: {}
    };

    // one-time tab click binding
    (function setupTabs(){
      const modal = document.getElementById('event-modal');
      const btns  = modal.querySelectorAll('.tab-btn');
      console.log('UI.js loaded, tab buttons found:', btns.length);
      btns.forEach(btn=>{
        btn.addEventListener('click', e=>{
          console.log('Tab clicked:', btn.dataset.tab);
          // activate button
          btns.forEach(b=>b.classList.toggle('active', b===btn));
          // show pane
          modal.querySelectorAll('.tab-pane').forEach(p=>{
            p.classList.toggle('active', p.id === 'tab-'+btn.dataset.tab);
          });
        });
      });
    })();
  }
};

// Also attach to window for global access
window.ui = ui;