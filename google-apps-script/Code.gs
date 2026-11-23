// Google Apps Script Web App pro synchronizaci domácích úkolů z EduPage do Google Tasks
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
    const items = payload.tasks || [];
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

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, results: results }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
