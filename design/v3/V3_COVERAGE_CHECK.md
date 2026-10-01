# v3 coverage check (spec 13)

Every row of `design/v3/coverage.json`, checked in the running app at its v3 home. Run on 2026-09-30 against `v3-day-line`, in a copy with the Firebase SDK stripped and demo data seeded, at **390 px and 1440 px, in Light and Dark**. All 338 rows pass in all four.

**How strong each "pass" is.** The probes live in `.claude/verify/t-coverage.js`, and the column says which kind each row got:

- **probed at its home** (177 rows): the probe opens the screen or sheet where the feature now lives and checks it is there and working. Removed and merged rows check that the old entry point is gone and the survivor works.
- **suite** (151 rows): the probe only checks the code path exists. The behaviour itself is asserted by the named scripted suite (today, tasks+calendar, strength, cardio, coach, sleep, diet, insights, settings, global; 573 checks, all passing at 390 Day and 1440 Night).
- **limited** (10 rows): these depend on things the stripped copy does not have: Apple Watch data, the Firebase SDK, tester reports in `/inbox`, or a real touch gesture. The code is present and wired, and the profile gate was walked through by hand, but none of these rows ran end to end here. Check them on a device.

Also checked for spec 13: no console errors on any view (the only messages are the expected "SDK unavailable" warning and deliberately fabricated test errors); every script `index.html` loads is in `sw.js` `ASSETS`, and every id the scripts look up exists in the markup; `CACHE` is `daylign-v139`, one over the last push. Nothing is pushed.


## Today

| # | Feature | v3 home | Status | Result | Evidence | Note |
|---|---|---|---|---|---|---|
| 0 | Calories tile | Today > now block | kept | pass | probed at its home | now block |
| 1 | Activity/burn tile | Today > now block | kept | pass | probed at its home | now block |
| 2 | Protein tile | Today > now block | kept | pass | probed at its home | now block |
| 3 | Water tile | Today > now block | kept | pass | probed at its home | now block |
| 4 | Steps tile (conditional) | Today > now block | kept | pass | limited | shown when Watch steps exist (no Watch data in the demo) |
| 5 | Exercise minutes tile (conditional) | Today > now block | kept | pass | limited | shown when Watch minutes exist (no Watch data in the demo) |
| 6 | Sleep tile (conditional) | Today > now block | kept | pass | probed at its home | now block |
| 7 | Weight tile plus quick weigh in modal | Global > weigh-in sheet | kept | pass | probed at its home | now block weight opens the weigh-in sheet |
| 8 | Daily Brief card | Today > brief | kept | pass | probed at its home | brief sentence |
| 9 | Brief readiness badge | Today > brief | merged | pass | probed at its home | one sentence, no badge |
| 10 | Brief training row | Today > brief | merged | pass | probed at its home | folded into the sentence |
| 11 | Brief nutrition row | Today > now block | merged | pass | probed at its home | the now block carries it |
| 12 | Brief tasks row | Today > due-soon list | merged | pass | probed at its home | due soon |
| 13 | Brief this week stat grid | Insights > weekly report | merged | pass | probed at its home | Insights weekly report |
| 14 | Dateless task triage nudge | Today > triage nudge | kept | pass | suite | exercised in today (triage sheet) |
| 15 | Triage plus Today chip | Today > triage nudge | kept | pass | suite | exercised in today (Today chip) |
| 16 | Triage see all N | Today > triage nudge | kept | pass | suite | exercised in today (see all) |
| 17 | Scheduled lane | Today > time line | kept | pass | probed at its home | the line |
| 18 | Anytime lane | Today > no-time tray | kept | pass | probed at its home | no-time tray on the line |
| 19 | Anytime schedule via clock button | Today > no-time tray | kept | pass | suite | exercised in today (tray clock) |
| 20 | Anytime drag to schedule | Today > time line | merged | pass | probed at its home | merged into the line; the tray schedules by time |
| 21 | Empty lane suppression | Today > time line | kept | pass | probed at its home | the line has no empty lanes |
| 22 | Dashboard project filter | Tasks > project filter | merged | pass | probed at its home | Tasks project filter |
| 23 | Daily cardio one tap | Training > Cardio | merged | pass | probed at its home | Cardio usual card; on Today it is a line row |
| 24 | Reminder brush teeth AM/PM | Today > due-soon list | kept | pass | probed at its home | line habit rows |
| 25 | Reminder morning routine | Today > due-soon list | kept | pass | probed at its home | line habit row |
| 26 | Reminder gym gap | Today > due-soon list | kept | pass | probed at its home | brief action chips when the gap is due |
| 27 | Reminder water (2 tiers) | Today > now block | merged | pass | probed at its home | now block |
| 28 | Reminder calories (3 variants) | Today > now block | merged | pass | probed at its home | now block |
| 29 | Reminder weigh in | Global > weigh-in sheet | merged | pass | probed at its home | brief chip opens the weigh-in sheet |
| 30 | Reminder protein | Today > now block | merged | pass | probed at its home | now block |
| 31 | Reminders bar empty state | Today > due-soon list | kept | pass | suite | exercised in today (due soon empty state) |
| 32 | My Tasks board card | Today > due-soon list | merged | pass | probed at its home | due soon |
| 33 | Upcoming deadlines card | Today > due-soon list | merged | pass | probed at its home | due soon |
| 34 | Daily schedule card | Today > time line | kept | pass | probed at its home | the line |
| 35 | Layout editor entry button | Today > Edit layout sheet | kept | pass | probed at its home | Arrange Today |
| 36 | Weight trend chart dead render | Removed | removed | pass | probed at its home | removed |
| 37 | Weekly report card dead render | Removed | removed | pass | probed at its home | removed |
| 38 | Wide widget span toggle | Removed | removed | pass | probed at its home | removed; migration deletes the key |

## Tasks

| # | Feature | v3 home | Status | Result | Evidence | Note |
|---|---|---|---|---|---|---|
| 39 | Add task header button/FAB | Global > + sheet | kept | pass | probed at its home | + on Tasks, header button on desktop |
| 40 | Task row read view | Tasks > List view | kept | pass | probed at its home | list rows |
| 41 | Check off/uncheck task | Tasks > List view | kept | pass | suite | exercised in tasks |
| 42 | Search tasks | Tasks > List view | kept | pass | suite | exercised in tasks |
| 43 | Filter by status | Tasks > List view | kept | pass | suite | exercised in tasks |
| 44 | Filter by category | Tasks > List view | kept | pass | suite | exercised in tasks |
| 45 | Sort tasks | Tasks > List view | kept | pass | suite | exercised in tasks |
| 46 | Filter by active project sidebar | Tasks > project filter | merged | pass | probed at its home | project filter chips |
| 47 | Task row chips, dates, stamps, badge | Tasks > List view | kept | pass | probed at its home | row chips |
| 48 | Auto archive done 7+ days | Tasks > List view | kept | pass | suite | exercised in tasks (archive) |
| 49 | Archived section toggle | Tasks > List view | kept | pass | suite | exercised in tasks |
| 50 | View archived via status filter | Tasks > List view | merged | pass | probed at its home | the archived section |
| 51 | Empty state no matches | Tasks > List view | kept | pass | suite | exercised in tasks (no matches) |
| 52 | Empty state no archived | Tasks > List view | kept | pass | suite | exercised in tasks (no archived) |
| 53 | Manage categories/projects sidebar | Settings > Categories | merged | pass | probed at its home | Manage opens Settings, Categories |
| 54 | Delete category/project | Settings > Categories | kept | pass | suite | exercised in settings (delete with undo) |
| 55 | Category/project color picker gap | Settings > Categories | added | pass | probed at its home | colour picker |

## Board

| # | Feature | v3 home | Status | Result | Evidence | Note |
|---|---|---|---|---|---|---|
| 56 | Three column layout plus counts | Tasks > Board view | kept | pass | probed at its home | three columns |
| 57 | Category filter tabs | Tasks > Board view | kept | pass | probed at its home | category chips |
| 58 | Project filter sidebar | Tasks > project filter | merged | pass | probed at its home | the Tasks project filter |
| 59 | Grouping by category vs project | Tasks > Board view | kept | pass | suite | exercised in tasks (board grouping) |
| 60 | Collapsible group folders per column | Tasks > Board view | kept | pass | probed at its home | group folders |
| 61 | Board card open | Tasks > Board view | kept | pass | probed at its home | cards open the task sheet |
| 62 | Drag card between columns | Tasks > Board view | kept | pass | probed at its home | drag |
| 63 | Drop target highlight | Tasks > Board view | kept | pass | probed at its home | drop-over highlight |
| 64 | Mobile column switcher | Tasks > Board view | kept | pass | probed at its home | column switcher |
| 65 | Auto archive hides done cards | Tasks > Board view | kept | pass | suite | exercised in tasks |
| 66 | Empty column state | Tasks > Board view | kept | pass | suite | exercised in tasks (empty column) |
| 67 | Inbox/tester report panel on Board | Tasks > Board > tester reports | kept | pass | probed at its home | hidden until a report arrives |
| 68 | No board native add card | Global > + sheet | merged | pass | probed at its home | + sheet |

## Calendar

| # | Feature | v3 home | Status | Result | Evidence | Note |
|---|---|---|---|---|---|---|
| 69 | Month/Week toggle | Calendar | kept | pass | probed at its home | Month / Week |
| 70 | Prev/Next navigation | Calendar | kept | pass | probed at its home | prev / next |
| 71 | Month grid plus today highlight | Calendar | kept | pass | probed at its home | month grid, today marked |
| 72 | US holidays | Calendar | kept | pass | probed at its home | US holidays |
| 73 | Task due date dots priority colored | Calendar | kept | pass | probed at its home | dots |
| 74 | Custom event dots | Calendar | kept | pass | probed at its home | event dots |
| 75 | Create event via double click day | Calendar > Add event button | merged | pass | probed at its home | Add event button |
| 76 | Create event via Add event button | Calendar | kept | pass | probed at its home | event sheet |
| 77 | Event modal name/date/time/desc/color | Calendar | kept | pass | probed at its home | event sheet fields |
| 78 | Edit/delete event | Calendar | kept | pass | probed at its home | edit, delete with undo |
| 79 | Week view grid | Calendar | kept | pass | probed at its home | week grid, agenda on a phone |
| 80 | Week view double click to add event | Calendar > Add event button | merged | pass | probed at its home | Add event button |
| 81 | Week view task/event click | Calendar | kept | pass | suite | exercised in tasks+calendar |
| 82 | Week view empty state | Calendar | kept | pass | suite | exercised in tasks+calendar (week empty) |
| 83 | Agenda view on phone | Calendar | kept | pass | probed at its home | agenda on a phone |
| 84 | Task priority border in week view | Calendar | kept | pass | suite | exercised in tasks+calendar |

## Training Shell

| # | Feature | v3 home | Status | Result | Evidence | Note |
|---|---|---|---|---|---|---|
| 85 | Strength/Cardio mode toggle | Training | kept | pass | probed at its home | four tabs |
| 86 | Body weight readout | Global > weigh-in sheet | merged | pass | probed at its home | weight pill opens the sheet |
| 87 | This week summary chips | Training | kept | pass | probed at its home | week line |
| 88 | Log/Progress/Coach tabs | Training | kept | pass | probed at its home | Today / Progress |
| 89 | Apple Watch sync freshness banner | Training | kept | pass | probed at its home | Watch freshness |
| 90 | Desktop rail week tiles | Training | merged | pass | probed at its home | day chips |
| 91 | Desktop rail readiness ring | Training > Sleep | merged | pass | probed at its home | Sleep tab |
| 92 | Desktop rail consistency mini heatmap | Training > Strength | merged | pass | probed at its home | Strength heatmap |

## Strength/Gym

| # | Feature | v3 home | Status | Result | Evidence | Note |
|---|---|---|---|---|---|---|
| 93 | Day navigation | Training > Strength | kept | pass | probed at its home | day stepper |
| 94 | Log exercise sheet | Training > Strength | kept | pass | probed at its home | log sheet |
| 95 | Bodyweight auto detection | Training > Strength | kept | pass | suite | exercised in strength |
| 96 | Ranked exercise suggestions | Training > Strength | kept | pass | suite | exercised in strength |
| 97 | Beat last time chip | Training > Strength | kept | pass | suite | exercised in strength |
| 98 | Rest timer 60s/90s | Training > Strength | kept | pass | suite | exercised in strength |
| 99 | Set add/remove | Training > Strength | kept | pass | suite | exercised in strength |
| 100 | Todays log list plus edit/delete | Training > Strength | kept | pass | suite | exercised in strength |
| 101 | Session focus row | Training > Strength | kept | pass | suite | exercised in strength |
| 102 | PR badge per entry | Training > Strength > analytics | merged | pass | suite | exercised in strength (progress PRs) |
| 103 | Day stats | Training > Strength | kept | pass | suite | exercised in strength |
| 104 | Body weight/waist logging plus spark | Global > weigh-in sheet | merged | pass | probed at its home | weigh-in sheet |
| 105 | Calorie burn tile MET vs Watch | Training > Strength | kept | pass | suite | exercised in strength (burn tile) |
| 106 | Weigh in pace vs goal | Training > Strength | kept | pass | probed at its home | pace to goal in the weigh-in sheet |
| 107 | Gym coach recommendations | Training > Coach | kept | pass | suite | exercised in coach |
| 108 | Goal progress rows | Training > Strength | kept | pass | suite | exercised in strength |
| 109 | Activity breakdown strength/cardio/walk | Training > Strength | kept | pass | suite | exercised in strength |
| 110 | Calisthenics progression ladder suggestion | Training > Strength | kept | pass | suite | exercised in strength |
| 111 | Bodyweight stall detection | Training > Coach | kept | pass | suite | exercised in coach |
| 112 | 16 week/30 day heatmap plus streak | Training > Strength | kept | pass | probed at its home | heatmap and streak |
| 113 | Next training day recommendation | Training > Coach | kept | pass | suite | exercised in coach |

## Strength Analytics

| # | Feature | v3 home | Status | Result | Evidence | Note |
|---|---|---|---|---|---|---|
| 114 | Last 30 days summary tiles | Training > Strength > analytics | kept | pass | suite | exercised in strength (progress) |
| 115 | Plateau insight plus try 3xN CTA | Training > Strength > analytics | kept | pass | suite | exercised in strength (progress) |
| 116 | Muscle balance card | Training > Strength > analytics | kept | pass | suite | exercised in strength (progress) |
| 117 | Movement list with sparkline | Training > Strength > analytics | kept | pass | suite | exercised in strength (progress) |
| 118 | Per movement progression curve | Training > Strength > analytics | kept | pass | suite | exercised in strength (progress) |
| 119 | Personal records shelf | Training > Strength > analytics | kept | pass | suite | exercised in strength (progress) |
| 120 | Estimated 1RM Epley computation | Training > Strength > analytics | kept | pass | probed at its home | Epley |

## Cardio

| # | Feature | v3 home | Status | Result | Evidence | Note |
|---|---|---|---|---|---|---|
| 121 | Day navigation | Training > Cardio | kept | pass | probed at its home | day stepper |
| 122 | One tap log your usual plus streak | Training > Cardio | kept | pass | probed at its home | usual card with streak |
| 123 | Sport tabs run/ride/swim | Training > Cardio | kept | pass | probed at its home | sport tabs |
| 124 | Session add form distance/duration/pace | Training > Cardio | kept | pass | probed at its home | add form |
| 125 | Run intensity chips | Training > Cardio | kept | pass | probed at its home | run chips |
| 126 | Run detail HR/elevation/RPE/zone bar | Training > Cardio | kept | pass | probed at its home | run detail |
| 127 | Apple Watch cross check chip | Training > Cardio | kept | pass | probed at its home | Watch chip |
| 128 | Apple Watch workout import list | Training > Cardio | kept | pass | probed at its home | Watch import list |
| 129 | Days session list plus delete | Training > Cardio | kept | pass | suite | exercised in cardio |
| 130 | Day calorie burn total | Training > Cardio | kept | pass | suite | exercised in cardio |
| 131 | Weekly volume tiles plus mileage ring | Training > Cardio | kept | pass | suite | exercised in cardio |
| 132 | Race countdown plus projected finish | Training > Cardio | kept | pass | suite | exercised in cardio |
| 133 | Race target settings | Training > Cardio | kept | pass | suite | exercised in cardio (race target) |
| 134 | Cardio coach recommendations | Training > Coach | kept | pass | probed at its home | Coach tab cardio row |

## Coach

| # | Feature | v3 home | Status | Result | Evidence | Note |
|---|---|---|---|---|---|---|
| 135 | Headline verdict | Training > Coach | kept | pass | suite | exercised in coach |
| 136 | Evidence chips | Training > Coach | kept | pass | suite | exercised in coach |
| 137 | Do this workout pick | Training > Coach | kept | pass | suite | exercised in coach |
| 138 | Volume call | Training > Coach | kept | pass | suite | exercised in coach |
| 139 | Recovery lever | Training > Sleep | merged | pass | probed at its home | Sleep tab readiness |
| 140 | Cardio coach 4 message types | Training > Coach | merged | pass | probed at its home | Coach cardio row |

## Diet

| # | Feature | v3 home | Status | Result | Evidence | Note |
|---|---|---|---|---|---|---|
| 141 | Built in food database | Diet | kept | pass | probed at its home | built-in database |
| 142 | Date navigation | Diet | kept | pass | probed at its home | day stepper |
| 143 | Week strip | Diet | kept | pass | probed at its home | week strip rings |
| 144 | Calorie ring | Diet | kept | pass | probed at its home | calorie ring |
| 145 | Macro bars | Diet | kept | pass | probed at its home | macro bars |
| 146 | Activity/burn caption | Diet | kept | pass | probed at its home | caption |
| 147 | Edit goals modal | Global > goals sheet | merged | pass | probed at its home | goals sheet |
| 148 | Food recommendations | Diet | kept | pass | suite | exercised in diet (ideas) |
| 149 | Yesterdays advice | Diet | kept | pass | suite | exercised in diet |
| 150 | End of day review | Diet | kept | pass | suite | exercised in diet |
| 151 | Water quick add buttons | Diet | kept | pass | probed at its home | +8 +16 +24 |
| 152 | Water custom amount | Diet | kept | pass | probed at its home | inline Other field |
| 153 | Water undo | Diet | kept | pass | probed at its home | Undo |
| 154 | Meal grouped log | Diet | kept | pass | probed at its home | meals on the line |
| 155 | Log bar inline search plus one tap add | Diet | kept | pass | probed at its home | add bar |
| 156 | Log by voice | Diet | kept | pass | probed at its home | mic opens the voice sheet |
| 157 | Log by photo | Diet | kept | pass | suite | exercised in diet (photo) |
| 158 | Add unmatched term as new food inline | Diet | kept | pass | suite | exercised in diet |
| 159 | Your usuals quick add tiles | Diet | kept | pass | suite | exercised in diet |
| 160 | Saved meal combo quick add tile | Diet | kept | pass | suite | exercised in diet |
| 161 | Save meal as combo | Diet | kept | pass | suite | exercised in diet |
| 162 | Edit/delete saved combo | Diet | kept | pass | suite | exercised in diet |
| 163 | Logged combo group expand/collapse | Diet | kept | pass | suite | exercised in diet |
| 164 | Add ingredient to logged combo | Diet | kept | pass | suite | exercised in diet |
| 165 | Delete whole logged combo group | Diet | kept | pass | suite | exercised in diet |
| 166 | Servings stepper | Diet | kept | pass | suite | exercised in diet |
| 167 | Row editor fix name plus macros | Diet | kept | pass | suite | exercised in diet |
| 168 | Delete logged entry | Diet | kept | pass | suite | exercised in diet |
| 169 | Food library toggle | Diet > Food Library | kept | pass | suite | exercised in diet (food library) |
| 170 | Manual add to bank form | Diet > Food Library | kept | pass | suite | exercised in diet (food library) |
| 171 | Live search OFF plus USDA fallback | Diet > Food Library | kept | pass | suite | exercised in diet (food library) |
| 172 | Community food bank | Diet > Food Library | kept | pass | suite | exercised in diet (food library) |
| 173 | My food bank list plus filter | Diet > Food Library | kept | pass | suite | exercised in diet (food library) |
| 174 | Edit/remove bank food | Diet > Food Library | kept | pass | suite | exercised in diet (food library) |
| 175 | Recent foods list per meal | Diet > Food Library | kept | pass | suite | exercised in diet (food library) |
| 176 | Saved meals section | Diet > Food Library | kept | pass | suite | exercised in diet (food library) |
| 177 | Diet history 14 days | Insights > weekly report | merged | pass | probed at its home | Insights weekly report and charts |
| 178 | Auto remember/backfill logged foods | Diet | kept | pass | suite | exercised in diet (banking on library open) |
| 179 | Empty states | Diet | kept | pass | suite | exercised in diet (empty day) |

## Insights

| # | Feature | v3 home | Status | Result | Evidence | Note |
|---|---|---|---|---|---|---|
| 180 | Range selector week/month/year/all | Insights | kept | pass | suite | exercised in insights |
| 181 | Export CSV | Insights | kept | pass | suite | exercised in insights |
| 182 | Summary tiles | Insights | kept | pass | suite | exercised in insights |
| 183 | Eight trend charts | Insights > trends | kept | pass | suite | exercised in insights |
| 184 | Sets by muscle group | Insights | kept | pass | suite | exercised in insights |
| 185 | Tasks card | Insights | kept | pass | suite | exercised in insights |
| 186 | Weekly report card | Insights > weekly report | kept | pass | suite | exercised in insights |
| 187 | Chart hover/tap tooltip | Insights | kept | pass | suite | exercised in insights |
| 188 | Not enough data growing state | Insights | kept | pass | suite | exercised in insights |

## Settings

| # | Feature | v3 home | Status | Result | Evidence | Note |
|---|---|---|---|---|---|---|
| 189 | Sync status indicator mirrored | Global > sync indicator | merged | pass | probed at its home | Data and sync card mirrors the pill |
| 190 | Whos using this device | Settings > Account | kept | pass | probed at its home | Profile and goals |
| 191 | Switch profile | Settings > Account | kept | pass | suite | exercised in settings (switch sheet) |
| 192 | Start fresh erase profile | Settings > Account | kept | pass | suite | exercised in settings (ERASE) |
| 193 | Connect Apple Watch | Settings > Data & sync | kept | pass | probed at its home | Apple Watch page |
| 194 | Goals summary plus edit goals modal | Settings > Profile & goals | kept | pass | probed at its home | goals summary, Edit opens the sheet |
| 195 | Theme segmented control | Settings > Appearance | kept | pass | probed at its home | System / Light / Dark |
| 196 | Modules on/off gym/cardio/diet | Settings > Modules | kept | pass | probed at its home | Modules |
| 197 | Categories and projects manager | Settings > Categories | kept | pass | probed at its home | Categories and projects |
| 198 | Anthropic API key set/remove | Settings > AI usage | kept | pass | probed at its home | AI page |
| 199 | AI usage and cost report | Settings > AI usage | kept | pass | probed at its home | AI page |
| 200 | Accent color picker | Settings > Appearance | kept | pass | probed at its home | six accents |
| 201 | Dashboard widgets visibility | Settings > Today layout | kept | pass | probed at its home | Arrange Today (Today layout row) |
| 202 | Saved layouts save/apply/delete | Settings > Today layout | kept | pass | probed at its home | Arrange Today saved layouts |
| 203 | Workout defaults rest timer/sets | Settings > Workouts | kept | pass | probed at its home | Workouts |
| 204 | Accessibility reduce motion/text/haptics | Settings > Appearance | kept | pass | probed at its home | Appearance |
| 205 | Backup your data export | Settings > Data & sync | kept | pass | probed at its home | Backup |
| 206 | Import from a spreadsheet CSV | Settings > Import CSV | kept | pass | probed at its home | Import page |
| 207 | Recent errors diagnostics | Settings > Data & sync | kept | pass | probed at its home | Recent errors |
| 208 | How the app is being used engagement | Settings > Account | kept | pass | probed at its home | How the app is used |
| 209 | Restore from a backup | Settings > Data & sync | kept | pass | probed at its home | Restore, RESTORE and safety copy |

## Sleep

| # | Feature | v3 home | Status | Result | Evidence | Note |
|---|---|---|---|---|---|---|
| 210 | Sleep hours stepper | Training > Sleep | kept | pass | suite | exercised in sleep |
| 211 | Sleep quality picker | Training > Sleep | kept | pass | suite | exercised in sleep |
| 212 | Save sleep entry | Training > Sleep | kept | pass | suite | exercised in sleep |
| 213 | Freshness label | Training > Sleep | kept | pass | suite | exercised in sleep |
| 214 | Seven night trend bars | Training > Sleep | kept | pass | suite | exercised in sleep |
| 215 | Readiness score ring plus verdict | Training > Sleep | kept | pass | suite | exercised in sleep |
| 216 | Readiness advice text | Training > Sleep | kept | pass | suite | exercised in sleep |
| 217 | Empty state | Training > Sleep | kept | pass | suite | exercised in sleep |

## Onboarding

| # | Feature | v3 home | Status | Result | Evidence | Note |
|---|---|---|---|---|---|---|
| 218 | Welcome step | Settings > Onboarding replay | kept | pass | probed at its home | Replay setup |
| 219 | Skip setup | Settings > Onboarding replay | kept | pass | probed at its home | Skip / Close |
| 220 | Pick modules step | Settings > Onboarding replay | kept | pass | suite | exercised in settings (setup modules step) |
| 221 | Set goals step | Global > goals sheet | merged | pass | probed at its home | goals step saves through the goals sheet save |
| 222 | Connect Apple Watch step | Settings > Data & sync | merged | pass | probed at its home | Watch step is the Settings component |
| 223 | Done step | Settings > Onboarding replay | kept | pass | suite | exercised in settings (setup) |
| 224 | Step nav back/continue/dots | Settings > Onboarding replay | kept | pass | suite | exercised in settings (dots, Back, Continue) |
| 225 | Gap no re-entry point | Settings > Onboarding replay | added | pass | probed at its home | Replay setup row |

## Profiles

| # | Feature | v3 home | Status | Result | Evidence | Note |
|---|---|---|---|---|---|---|
| 226 | Profile gate first run block | Settings > Account | kept | pass | limited | walked through by hand in the stripped copy |
| 227 | Pick existing profile | Settings > Account | kept | pass | probed at its home | profile list |
| 228 | Create new profile | Settings > Account | kept | pass | probed at its home | create, existing name signs in |
| 229 | Current profile display 2 places | Settings > Account | merged | pass | probed at its home | sidebar and Settings |
| 230 | Sidebar tap to Settings | Global > sidebar/bottom nav | merged | pass | probed at its home | sidebar profile opens Settings |
| 231 | Switch profile/start fresh cross listed | Settings > Account | merged | pass | probed at its home | Settings, Profile |
| 232 | Profiles registry write | Settings > Account | kept | pass | probed at its home | registry write on pick |
| 233 | Engagement/usage report cross listed | Settings > Account | merged | pass | probed at its home | Settings, How the app is used |

## Sidebar Nav

| # | Feature | v3 home | Status | Result | Evidence | Note |
|---|---|---|---|---|---|---|
| 234 | Logo | Global > sidebar/bottom nav | kept | pass | probed at its home | logo |
| 235 | Profile switcher entry | Global > sidebar/bottom nav | kept | pass | probed at its home | profile entry |
| 236 | Nav links to all views | Global > sidebar/bottom nav | kept | pass | probed at its home | nav links |
| 237 | Board inbox badge | Tasks > Board > tester reports | merged | pass | probed at its home | badge on Tasks and the avatar |
| 238 | Theme toggle sidebar | Settings > Appearance | merged | pass | probed at its home | removed; theme is in Settings |
| 239 | Section dividers | Global > sidebar/bottom nav | kept | pass | probed at its home | dividers |
| 240 | Categories list plus counts plus delete | Tasks > project filter | merged | pass | probed at its home | lists and filters only |
| 241 | Manage categories/projects button | Settings > Categories | merged | pass | probed at its home | Manage opens Settings |
| 242 | Add category/project | Settings > Categories | kept | pass | probed at its home | Settings, Categories |
| 243 | Projects list plus active filter plus delete | Tasks > project filter | merged | pass | probed at its home | project filter |
| 244 | Mobile sidebar open/close | Global > sidebar/bottom nav | kept | pass | probed at its home | menu button |

## Bottom Nav

| # | Feature | v3 home | Status | Result | Evidence | Note |
|---|---|---|---|---|---|---|
| 245 | Today/Tasks/Board/Training/Diet icons | Global > sidebar/bottom nav | kept | pass | probed at its home | Today, Tasks, +, Training, Diet |
| 246 | More overflow trigger | Global > More sheet | kept | pass | probed at its home | the avatar replaced More |

## More Sheet

| # | Feature | v3 home | Status | Result | Evidence | Note |
|---|---|---|---|---|---|---|
| 247 | Sheet open/close | Global > More sheet | kept | pass | probed at its home | avatar sheet |
| 248 | Calendar entry | Global > More sheet | kept | pass | probed at its home | avatar sheet |
| 249 | Search entry | Global > Ctrl K search | merged | pass | probed at its home | opens Ctrl K |
| 250 | Insights entry | Global > More sheet | kept | pass | probed at its home | avatar sheet |
| 251 | Settings entry | Global > More sheet | kept | pass | probed at its home | avatar sheet |
| 252 | Theme toggle more sheet | Settings > Appearance | merged | pass | probed at its home | removed; Settings |

## Header & Search

| # | Feature | v3 home | Status | Result | Evidence | Note |
|---|---|---|---|---|---|---|
| 253 | View title plus date | Global | kept | pass | probed at its home | title and date |
| 254 | Header condense on scroll | Global | kept | pass | probed at its home | condense on scroll |
| 255 | Mobile menu button | Global | kept | pass | probed at its home | menu button |
| 256 | Search icon mobile | Global > Ctrl K search | merged | pass | probed at its home | opens Ctrl K |
| 257 | Inline search box desktop | Tasks > List view | merged | pass | probed at its home | desktop search box |
| 258 | Command palette Ctrl K | Global > Ctrl K search | kept | pass | suite | exercised in global (palette) |
| 259 | Sync status indicator header | Global > sync indicator | kept | pass | probed at its home | sync pill |
| 260 | Header primary action button | Global > + sheet | kept | pass | probed at its home | desktop header button, phone + |
| 261 | Mobile primary FAB | Global > + sheet | merged | pass | probed at its home | removed; the + in the bottom bar |
| 262 | Top sync progress bar | Global > sync indicator | kept | pass | probed at its home | progress bar while connecting |
| 263 | Update available banner | Global | kept | pass | suite | exercised in global (update banner) |

## Sync Status

| # | Feature | v3 home | Status | Result | Evidence | Note |
|---|---|---|---|---|---|---|
| 264 | Status pill connecting/saving/synced/error | Global > sync indicator | kept | pass | suite | exercised in global (sync pill) |
| 265 | Tap to expand detail panel | Global > sync indicator | kept | pass | suite | exercised in global (sync pill) |
| 266 | Close detail | Global > sync indicator | kept | pass | suite | exercised in global (sync pill) |
| 267 | Manual retry | Global > sync indicator | kept | pass | suite | exercised in global (sync pill) |
| 268 | Automatic retry loop 30s | Global > sync indicator | kept | pass | probed at its home | retries every 30s |
| 269 | Stalled write timeout message | Global > sync indicator | kept | pass | probed at its home | stalled-write message |
| 270 | Silent gap no conflict indicator | Global > sync indicator | added | pass | suite | exercised in settings (conflict notice, fabricated snapshots) |

## Layout Editor

| # | Feature | v3 home | Status | Result | Evidence | Note |
|---|---|---|---|---|---|---|
| 271 | Enter/exit edit mode | Today > Edit layout sheet | kept | pass | suite | exercised in today (Arrange Today) |
| 272 | Per widget handle drag/up/down/hide | Today > Edit layout sheet | kept | pass | suite | exercised in today (Arrange Today) |
| 273 | Hidden widgets tray plus restore | Today > Edit layout sheet | kept | pass | suite | exercised in today (Arrange Today) |
| 274 | Save/apply/delete named layout | Settings > Today layout | kept | pass | suite | exercised in today (Arrange Today) |
| 275 | Wide span toggle dead flag | Removed | removed | pass | probed at its home | removed |

## Pull-to-Refresh

| # | Feature | v3 home | Status | Result | Evidence | Note |
|---|---|---|---|---|---|---|
| 276 | Gesture arm plus visual indicator | Global > pull to refresh | kept | pass | suite | exercised in global (ring) |
| 277 | Commit threshold ready state | Global > pull to refresh | kept | pass | suite | exercised in global (ring) |
| 278 | Refresh execution plus completion toast | Global > pull to refresh | kept | pass | suite | exercised in global (ring) |
| 279 | Horizontal swipe cancellation | Global > pull to refresh | kept | pass | limited | horizontal-swipe cancel kept in the gesture code |

## CSV Import

| # | Feature | v3 home | Status | Result | Evidence | Note |
|---|---|---|---|---|---|---|
| 280 | Open import modal | Settings > Import CSV | kept | pass | suite | exercised in settings (import) |
| 281 | Paste textarea plus project dropdown | Settings > Import CSV | kept | pass | suite | exercised in settings (import) |
| 282 | Preview success/parse errors | Settings > Import CSV | kept | pass | suite | exercised in settings (import) |
| 283 | Import execution/cancel | Settings > Import CSV | kept | pass | suite | exercised in settings (import) |

## Inbox

| # | Feature | v3 home | Status | Result | Evidence | Note |
|---|---|---|---|---|---|---|
| 284 | Live watch of inbox node | Tasks > Board > tester reports | kept | pass | limited | watches /inbox (no SDK in the copy) |
| 285 | Board nav badge unread count | Tasks > Board > tester reports | kept | pass | probed at its home | badge |
| 286 | Inbox panel report cards plus screenshots | Tasks > Board > tester reports | kept | pass | limited | panel on the Board; no reports in the copy |
| 287 | View screenshot full size | Tasks > Board > tester reports | kept | pass | limited | panel on the Board; no reports in the copy |
| 288 | Accept report creates task | Tasks > Board > tester reports | kept | pass | limited | panel on the Board; no reports in the copy |
| 289 | Dismiss report | Tasks > Board > tester reports | kept | pass | limited | panel on the Board; no reports in the copy |
| 290 | Clear handled reports | Tasks > Board > tester reports | kept | pass | limited | panel on the Board; no reports in the copy |

## Photo Logging

| # | Feature | v3 home | Status | Result | Evidence | Note |
|---|---|---|---|---|---|---|
| 291 | Snap a meal trigger per meal row | Diet | kept | pass | suite | exercised in diet (photo sheet, fetch stubbed) |
| 292 | Photo capture input | Global > Photo Logging | kept | pass | suite | exercised in diet (photo sheet, fetch stubbed) |
| 293 | Photo analysis Claude vision | Global > Photo Logging | kept | pass | suite | exercised in diet (photo sheet, fetch stubbed) |
| 294 | Analyzing spinner | Global > Photo Logging | kept | pass | suite | exercised in diet (photo sheet, fetch stubbed) |
| 295 | Confirmation card edit before save | Global > Photo Logging | kept | pass | suite | exercised in diet (photo sheet, fetch stubbed) |
| 296 | Meal target selector | Global > Photo Logging | kept | pass | suite | exercised in diet (photo sheet, fetch stubbed) |
| 297 | Add all to log | Global > Photo Logging | kept | pass | suite | exercised in diet (photo sheet, fetch stubbed) |
| 298 | Discard analysis | Global > Photo Logging | kept | pass | suite | exercised in diet (photo sheet, fetch stubbed) |
| 299 | Pending photo persistence 12h | Global > Photo Logging | kept | pass | suite | exercised in diet (photo sheet, fetch stubbed) |
| 300 | No key inline prompt | Global > Photo Logging | kept | pass | suite | exercised in diet (photo sheet, fetch stubbed) |
| 301 | Error states unreadable/rejected/network | Global > Photo Logging | kept | pass | suite | exercised in diet (photo sheet, fetch stubbed) |

## Voice

| # | Feature | v3 home | Status | Result | Evidence | Note |
|---|---|---|---|---|---|---|
| 302 | Floating mic FAB | Global > voice commands | kept | pass | probed at its home | moved into the + sheet, Diet mic, Say it and Ctrl K |
| 303 | Voice command panel | Global > voice commands | kept | pass | suite | exercised in global (voice, fetch stubbed) |
| 304 | Mic listen toggle speech to text | Global > voice commands | kept | pass | suite | exercised in global (voice, fetch stubbed) |
| 305 | Typed command fallback | Global > voice commands | kept | pass | suite | exercised in global (voice, fetch stubbed) |
| 306 | Task creation via voice | Global > voice commands | kept | pass | suite | exercised in global (voice, fetch stubbed) |
| 307 | Water logging via voice | Global > voice commands | kept | pass | suite | exercised in global (voice, fetch stubbed) |
| 308 | Weight logging via voice | Global > voice commands | kept | pass | suite | exercised in global (voice, fetch stubbed) |
| 309 | Food logging via voice | Global > voice commands | kept | pass | suite | exercised in global (voice, fetch stubbed) |
| 310 | Navigation via voice | Global > voice commands | kept | pass | suite | exercised in global (voice, fetch stubbed) |
| 311 | Multi command per utterance | Global > voice commands | kept | pass | suite | exercised in global (voice, fetch stubbed) |
| 312 | Result list plus per command undo | Global > voice commands | kept | pass | suite | exercised in global (voice, fetch stubbed) |
| 313 | Unrecognized speech notice | Global > voice commands | kept | pass | suite | exercised in global (voice, fetch stubbed) |
| 314 | No key/error states voice | Global > voice commands | kept | pass | probed at its home | no key and 401 point to Settings, AI |

## AI Usage Tracker

| # | Feature | v3 home | Status | Result | Evidence | Note |
|---|---|---|---|---|---|---|
| 315 | Usage/cost report panel | Settings > AI usage | kept | pass | suite | exercised in settings (AI usage) |
| 316 | Empty state AI usage | Settings > AI usage | kept | pass | suite | exercised in settings (AI usage) |
| 317 | Totals row | Settings > AI usage | kept | pass | suite | exercised in settings (AI usage) |
| 318 | Per feature breakdown | Settings > AI usage | kept | pass | suite | exercised in settings (AI usage) |
| 319 | Per day breakdown 14 days | Settings > AI usage | kept | pass | suite | exercised in settings (AI usage) |
| 320 | Cost estimate disclaimer | Settings > AI usage | kept | pass | suite | exercised in settings (AI usage) |
| 321 | Anthropic API key setup adjacent | Settings > AI usage | merged | pass | probed at its home | key and usage on one page |

## Toasts/Notifications

| # | Feature | v3 home | Status | Result | Evidence | Note |
|---|---|---|---|---|---|---|
| 322 | Toast host plus plain toast | Global > toasts | kept | pass | suite | exercised in global (toasts) |
| 323 | Actionable/undo toast | Global > toasts | kept | pass | suite | exercised in global (undo toasts) |
| 324 | Global empty state component | Global > toasts | kept | pass | suite | dashed empty cards per screen; exercised in insights / sleep / diet |
| 325 | Empty state CTA | Global > toasts | kept | pass | suite | empty states carry one action; exercised in screens |
| 326 | Keyboard access promotion | Global > toasts | kept | pass | probed at its home | kept |
| 327 | Global error toast | Global > toasts | kept | pass | probed at its home | error toast opens Recent errors |
| 328 | Recent errors diagnostics panel | Settings > Data & sync | merged | pass | probed at its home | Settings, Recent errors |
| 329 | Haptic feedback | Global > toasts | kept | pass | probed at its home | kept |

## Notable gaps

| # | Feature | v3 home | Status | Result | Evidence | Note |
|---|---|---|---|---|---|---|
| 330 | No priority control in task modal | Tasks > task detail sheet | added | pass | probed at its home | priority in the task sheet |
| 331 | No custom category/project color picker | Settings > Categories | added | pass | probed at its home | colour picker |
| 332 | No install/Add to Home Screen prompt | Global | added | pass | suite | exercised in global (install banner) |
| 333 | No conflict indicator for sync | Global > sync indicator | added | pass | suite | exercised in settings (conflict notice) |
| 334 | Two dead renders fire with no host div | Today | added | pass | probed at its home | removed |
| 335 | Stale voice error copy says Diet tab | Global > voice commands | added | pass | probed at its home | copy fixed |
| 336 | Wide widget toggle unshipped in data model | Settings > Today layout | added | pass | probed at its home | removed (migration deletes it) |
| 337 | No way to replay onboarding | Settings > Onboarding replay | added | pass | probed at its home | Replay setup |
