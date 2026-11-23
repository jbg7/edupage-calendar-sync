---
name: homework-to-calendar
description: Synchronize upcoming EduPage homework assignments to Google Tasks (checklist with due date set to today and deadline in title set to the day before submission) and announced tests/exams to Google Calendar at the exact lesson time from the student's EduPage timetable. Both Google Tasks and Google Calendar events are pushed directly via the Google Apps Script Web App endpoint (scripts/push_tasks.py) without requiring OAuth.
compatibility: Requires the edupage MCP server (read-only) and scripts/push_tasks.py.
metadata:
  mcp-server: edupage
  mcp-package: edupage-mcp-full
---

# EduPage Homework & Tests to Google Tasks / Google Calendar

This skill checks EduPage for upcoming **homework assignments** and **announced tests/exams** and syncs them directly to each student's Google account via their Google Apps Script Web App URL (`scripts/push_tasks.py`):
- **Homework (`payload.tasks`) ➡️ Google Tasks** (checklist item with `due` set to today and `[Deadline: ...]` set to the day before submission).
- **Tests / Exams (`payload.events`) ➡️ Google Calendar Events** (timed informative event placed at the exact lesson period from the student's EduPage timetable).

---

## Step-by-Step Workflow

### 1. Identify Today's Date & Student(s) Configuration
1. Note today's local date (`YYYY-MM-DD`).
2. Read `config.local.json` (or `~/.gemini/config/edupage-tasks.json`):
   - **Multi-student (parent) mode**: If `students` map is present (e.g., `jakub` -> `7.C`, `student_id: -1202` and `marek` -> `5.A`, `student_id: -1151`), process each student with a configured `webapp_url` and push their payload with `--student <key>`.
   - **Single-student mode**: Process the logged-in student account and push via default `gtasks_webapp_url`.

### 2. Fetch Upcoming Assignments & Full Details
1. Call `get_timeline(category="assignments")` on the `edupage` MCP server.
2. Filter to items whose target date (`additional_data.date` or date mentioned in text) is **today or in the future** (`date >= today`).
   - Also keep items created/updated within the last 4 days whose `additional_data.date` is within the current week in case the teacher wrote the actual due date inside the text (e.g., *"Příští týden ve středu/čtvrtek"*).
3. For each candidate item that has a valid `additional_data.superid` (not `False` or `null`), call `get_homework_material(superid=str(superid))` to retrieve `title`, `details`, `content`, `date_from`, `date_to`, and `attachments`.

### 3. Match Against the Student's Timetable (`get_student_timetable` / `get_my_timetable`)
For each assignment's submission/target date (`target_date`, e.g., `2026-11-25`):
1. Call `get_student_timetable(student_id=..., date_str=target_date)` (or `get_my_timetable(date_str=target_date)`).
2. Find the lesson whose `subject.name` (or `subject.short`) matches the subject from the assignment's `recipient` (e.g., `"7.C · Matematika"` -> `"Matematika"`).
3. Extract:
   - `period` (e.g. `2. hodina`)
   - `start_time` and `end_time` (e.g. `08:55:00` – `09:40:00`)
   - classroom name (if present) and teacher (`author`).

### 4. Build Payload (`tasks` and `events`) per Student

#### A) Homework ➡️ `tasks` array (Google Tasks)
For every homework assignment belonging to the student:
1. **`id`**: `str(superid)` if available, otherwise `str(event_id)`.
2. **`due`**: Today's date (`YYYY-MM-DD`) so the task appears on the student's calendar immediately today and rolls over every day until checked off.
3. **Deadline Date (Day Before Submission)**:
   - Compute `deadline_date = target_date - 1 day` (if `deadline_date < today`, set `deadline_date = today`).
   - Format in Czech short weekday + date, e.g., `Út 24.11.` (Po, Út, St, Čt, Pá, So, Ne).
4. **`title`**:
   ```text
   📚 [Deadline: <Day> <D.M.>] DÚ <Předmět>: <Stručné zadání do 70 znaků>
   ```
   *(Strip prefixes like `Změněné:` or `Geändert:`).*
5. **`notes`**:
   ```text
   Odevzdání: <Weekday> <D. M. YYYY> (<period>. hodina <HH:MM>–<HH:MM>, uč. <Author>)
   Předmět: <Recipient>
   Zadání:
   <Full text / title / content>
   ```

#### B) Announced Tests / Exams ➡️ `events` array (Google Calendar)
If an assignment or notification announces a test/exam (`test`, `písemka`, `čtvrtletní práce`, `zkoušení`) for `target_date`:
1. **`id`**: `"test-" + str(superid or event_id)`
2. **`title`**: `"📝 TEST <Předmět>: <Téma>"`
3. **`start` / `end`**: ISO/RFC3339 timestamps using the matched lesson time from Step 3 (e.g., `"2026-11-25T08:55:00"` and `"2026-11-25T09:40:00"`). If no lesson is matched on that day, set `"allDay": true` and `"start": "<YYYY-MM-DD>"`.
4. **`location`**: Classroom short name from the timetable (if available).
5. **`notes`**: Full test details + teacher name.

### 5. Push via `scripts/push_tasks.py`
Write the JSON payload (`{"tasks": [...], "events": [...]}`) in UTF-8 to a temporary JSON file (e.g., `/tmp/edupage_payload_<student>.json` or in workspace scratch) and run:

```bash
uv run python scripts/push_tasks.py --student <student_key> --file /tmp/edupage_payload_<student>.json
```
*(Or omit `--student` if using a single `gtasks_webapp_url`).*

The Google Apps Script endpoint automatically deduplicates both `tasks` and `events` by `[EduPage#<id>]` and returns a JSON report (`created`, `updated`, `skipped_existing`).

### 6. Report Summary
Output a clean Czech summary table per student showing which homework tasks and test events were created, updated, or skipped.
