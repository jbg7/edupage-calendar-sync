// Google Apps Script Web App pro synchronizaci z EduPage:
//   1. Domácí úkoly (payload.tasks)  -> Google Tasks (s checkboxem)
//   2. Písemky/testy (payload.events) -> Google Calendar (v přesném čase vyučovací hodiny)
// Nasazení: Deploy -> New deployment -> Web app (Execute as: Me, Who has access: Anyone)

function doGet(e) {
  try {
    const taskLists = Tasks.Tasklists.list();
    const listId = taskLists.items[0].id;
    const resp = Tasks.Tasks.list(listId, {
      showCompleted: true,
      showHidden: true,
      maxResults: 50
    });
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, listId: listId, items: resp.items || [] }, null, 2))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const taskItems = payload.tasks || [];
    const eventItems = payload.events || [];

    const taskResults = syncTasks_(taskItems);
    const eventResults = syncCalendarEvents_(eventItems);

    return ContentService
      .createTextOutput(JSON.stringify({
        ok: true,
        tasks: taskResults,
        events: eventResults
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function syncTasks_(items) {
  if (!items || items.length === 0) return [];

  const taskLists = Tasks.Tasklists.list();
  const listId = taskLists.items[0].id;

  // Načtení existujících úkolů kvůli deduplikaci podle [EduPage#<id>] v poznámce
  const existingByTag = {};
  let pageToken = null;
  do {
    const resp = Tasks.Tasks.list(listId, {
      showCompleted: true,
      showHidden: true,
      maxResults: 100,
      pageToken: pageToken
    });
    if (resp.items) {
      resp.items.forEach(t => {
        const match = (t.notes || "").match(/\[EduPage#([^\]]+)\]/);
        if (match) existingByTag[match[1]] = t;
      });
    }
    pageToken = resp.nextPageToken;
  } while (pageToken);

  const results = [];
  items.forEach(item => {
    const tag = String(item.id);
    const marker = "[EduPage#" + tag + "]";
    const notes = (item.notes || "") + "\n\n" + marker;
    const existing = existingByTag[tag];

    if (existing) {
      if (existing.status !== "completed" && (existing.title !== item.title || existing.notes !== notes)) {
        existing.title = item.title;
        existing.notes = notes;
        if (item.due) {
          existing.due = item.due.indexOf("T") === -1 ? (item.due + "T00:00:00.000Z") : item.due;
        }
        const updated = Tasks.Tasks.update(existing, listId, existing.id);
        results.push({ id: tag, action: "updated", taskId: updated.id });
      } else {
        results.push({ id: tag, action: "skipped_existing", taskId: existing.id, status: existing.status });
      }
    } else {
      const t = Tasks.newTask();
      t.title = item.title;
      t.notes = notes;
      if (item.due) {
        t.due = item.due.indexOf("T") === -1 ? (item.due + "T00:00:00.000Z") : item.due;
      }
      const created = Tasks.Tasks.insert(t, listId);
      results.push({ id: tag, action: "created", taskId: created.id, webViewLink: created.webViewLink });
    }
  });

  return results;
}

function syncCalendarEvents_(items) {
  if (!items || items.length === 0) return [];

  const cal = CalendarApp.getDefaultCalendar();
  const results = [];

  items.forEach(item => {
    const tag = String(item.id);
    const marker = "[EduPage#" + tag + "]";
    const description = (item.notes || item.description || "") + "\n\n" + marker;

    const startTime = new Date(item.start);
    const endTime = item.end ? new Date(item.end) : new Date(startTime.getTime() + 45 * 60 * 1000);

    // Vyhledání existujících událostí v daný den kvůli deduplikaci podle [EduPage#<id>]
    const dayStart = new Date(startTime.getFullYear(), startTime.getMonth(), startTime.getDate(), 0, 0, 0);
    const dayEnd = new Date(startTime.getFullYear(), startTime.getMonth(), startTime.getDate(), 23, 59, 59);
    const existingEvents = cal.getEvents(dayStart, dayEnd);

    let matchedEvent = null;
    for (let i = 0; i < existingEvents.length; i++) {
      const ev = existingEvents[i];
      const desc = ev.getDescription() || "";
      if (desc.indexOf(marker) !== -1) {
        matchedEvent = ev;
        break;
      }
    }

    if (matchedEvent) {
      let changed = false;
      if (matchedEvent.getTitle() !== item.title) {
        matchedEvent.setTitle(item.title);
        changed = true;
      }
      if (matchedEvent.getDescription() !== description) {
        matchedEvent.setDescription(description);
        changed = true;
      }
      if (!item.allDay && (matchedEvent.getStartTime().getTime() !== startTime.getTime() || matchedEvent.getEndTime().getTime() !== endTime.getTime())) {
        matchedEvent.setTime(startTime, endTime);
        changed = true;
      }
      if (item.location && matchedEvent.getLocation() !== item.location) {
        matchedEvent.setLocation(item.location);
        changed = true;
      }
      results.push({ id: tag, action: changed ? "updated" : "skipped_existing", eventId: matchedEvent.getId() });
    } else {
      let created;
      const options = {
        description: description,
        location: item.location || ""
      };
      if (item.allDay) {
        created = cal.createAllDayEvent(item.title, startTime, options);
      } else {
        created = cal.createEvent(item.title, startTime, endTime, options);
      }
      results.push({ id: tag, action: "created", eventId: created.getId() });
    }
  });

  return results;
}
