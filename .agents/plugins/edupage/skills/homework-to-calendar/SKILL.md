---
name: homework-to-calendar
description: Synchronize upcoming EduPage homework assignments to Google Tasks (checklist with due date set to today and deadline in title set to the day before submission) and announced tests/exams to Google Calendar at the exact lesson time from the student's EduPage timetable. Use when asked to check/sync homework, assignments, or tests from EduPage into Google Tasks / Google Calendar, or during scheduled background homework checks.
compatibility: Requires the edupage MCP server (read-only) and push_tasks.py (for Google Tasks) + gcalendar plugin (for tests/exams).
metadata:
  mcp-server: edupage
  mcp-package: edupage-mcp-full
---

# EduPage Homework & Tests to Google Tasks / Google Calendar

This skill checks EduPage for upcoming **homework assignments** and **announced tests/exams** and syncs them without duplicates:
- **Homework (`homework`) ➡️ Google Tasks** (checklist item via `scripts/push_tasks.py` and the user's Google Apps Script Web App URL).
- **Tests / Exams (`test`, `písemka`, `čtvrtletní práce`, exam assignments) ➡️ Google Calendar Events** (timed informative event placed at the exact lesson period from the student's EduPage timetable via `gcalendar`).

---

## Step-by-Step Workflow

### 1. Identify Today's Date & Student Context
1. Note today's local date (`YYYY-MM-DD`).
2. Call `get_subdomains` on the `edupage` MCP server to verify login state and role:
   - **Student account (`role: "student"`)**: Operate directly on the logged-in account; use `get_my_timetable` for timetable lookups.
   - **Parent account (`role: "parent"`)**: If a specific child is requested (or configured in `config.local.json`), switch to that student via `switch_to_student` or filter assignments by their class (e.g., `7.C`, `5.A`) and use `get_student_timetable`.

### 2. Fetch Upcoming Assignments & Full Details
1. Call `get_timeline(category="assignments")` on the `edupage` MCP server.
2. Filter to items whose due/target date (`additional_data.date` or parsed date) is **today or in the future** (`date >= today`).
   - Also keep items created/updated within the last 3 days whose `additional_data.date` is within the current week, in case the teacher wrote the actual due date inside the text (e.g., *"Příští týden ve středu/čtvrtek"*).
3. For each candidate item that has a valid `additional_data.superid` (not `False` or `null`), call `get_homework_material(superid=str(superid))` to retrieve:
   - `title`, `details`, `content`, `date_from`, `date_to`, and `attachments`.

### 3. Match Against the Student's Timetable (`get_my_timetable` / `get_student_timetable`)
For each assignment's submission/target date (`target_date`, e.g., `2026-11-25`):
1. Call `get_my_timetable(date_str=target_date)` (or `get_student_timetable(student_id=..., date_str=target_date)`).
2. Find the lesson whose `subject.name` (or `subject.short`) matches the subject from the assignment's `recipient` (e.g., `"7.C · Matematika"` -> `"Matematika"`).
3. Extract:
   - `period` (e.g. `2. hodina`)
   - `start_time` and `end_time` (e.g. `08:55` – `09:40`)
   - classroom name (if present) and teacher (`author`).

### 4. Classify: Homework vs. Test/Exam

#### A) Homework (`homework` / preparation / bring materials) ➡️ **Google Tasks**
For every homework assignment:
1. **Unique ID (`id`)**: Use `str(superid)` if available, otherwise `str(event_id)`.
2. **Scheduled Date (`due`)**: Set `due` to **today's date (`YYYY-MM-DD`)** so the task appears on the student's calendar immediately today and rolls over every day until checked off.
3. **Deadline Date (Day Before Submission)**:
   - Compute `deadline_date = target_date - 1 day` (if `deadline_date < today`, set `deadline_date = today`).
   - Format in Czech short weekday + date, e.g., `Út 24.11.` (Po, Út, St, Čt, Pá, So, Ne).
4. **Task Title (`title`)**:
   ```text
   📚 [Deadline: <Day> <D.M.>] DÚ <Předmět>: <Stručné zadání do 70 znaků>
   ```
   *(Remove noisy prefixes like `Změněné:` or `Geändert:` from the short summary).*
5. **Task Notes (`notes`)**:
   ```text
   Odevzdání: <Weekday> <D. M. YYYY> (<period>. hodina <HH:MM>–<HH:MM>, uč. <Author>)
   Předmět: <Recipient>
   Zadání:
   <Full text / title / content>
   <Attachments if any>
   ```
6. **Push to Google Tasks**:
   Run `scripts/push_tasks.py` (located in the workspace root or `~/.gemini/config/plugins/edupage/scripts/push_tasks.py`) passing the JSON array of homework tasks:
   ```bash
   python3 "<path_to_push_tasks.py>" --json '{"tasks": [...]}'
   ```
   *(On Windows, `uv run python "<path_to_push_tasks.py>" --json ...` or `python "<path_to_push_tasks.py>"` works identically. The Apps Script endpoint automatically deduplicates by `[EduPage#<id>]` and skips already-existing or completed tasks!)*

#### B) Announced Tests / Exams ➡️ **Google Calendar Event**
If an assignment or message announces a test/exam (`test`, `písemka`, `čtvrtletní práce`, `zkoušení`) for a specific date:
1. Activate and follow the `gcalendar` skill.
2. First check existing events on `target_date` via:
   ```bash
   gcalendar readonly events --date <YYYY-MM-DD> --max 50 --json
   ```
3. If an event for this test (`[EduPage#<id>]` in description or matching title) does not exist yet:
   - Use the exact `start_time` and `end_time` of the matched lesson from Step 3 (e.g., `2026-11-25T08:55:00` to `2026-11-25T09:40:00`; if no lesson is found on that day, create an `--all-day` event).
   - Create the event via:
     ```bash
     gcalendar mutate create \
       --summary "📝 TEST <Předmět>: <Téma>" \
       --start "<YYYY-MM-DD>T<HH:MM:SS>" \
       --end "<YYYY-MM-DD>T<HH:MM:SS>" \
       --description "<Detail zadání>\n\n[EduPage#<id>]"
     ```

### 5. Report Summary
Output a clean, concise Czech summary table showing:
- Which homework tasks were **created**, **updated**, or **skipped (already in Google Tasks / completed)**.
- Which test events were added to Google Calendar.
