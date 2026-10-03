# Locking the database

Today the database runs `firebase-rules-interim.json`: nothing can be deleted
wholesale, but **anyone with the URL can read your data** (the URL is in this
public repo). `firebase-rules.json` fixes that: only your signed-in account can
read or change anything.

The order matters. Rules that demand sign-in, published before the app can
sign in, lock the app out. So: console setup first (changes nothing for the
app), then ship the app with sign-in, then publish the rules.

Rollback at any point: paste `firebase-rules-interim.json` back and Publish.
A rules change never touches data.

---

## Part 1: Firebase console (you, about 5 minutes)

None of this affects the app as it runs today.

1. **Back up.** Settings, Data and sync, Download a backup.
2. **Turn on email sign-in.** Firebase console, Authentication, Sign-in
   method, Email/Password, Enable (leave "Email link" off), Save.
3. **Create your account.** Authentication, Users, Add user. Your email and a
   password. Copy the **User UID** it shows.
4. **Turn off sign-up.** Authentication, Settings, User actions: untick
   **Enable create (sign-up)**, Save. The web key is public, so with sign-up
   on, anyone could make an account.

Then tell Claude it is done. Claude ships the app (Part 2).

## Part 2: ship the app (Claude, on your OK)

The app gains a sign-in screen. Rules are still the interim ones, so syncing
works exactly as before once you are signed in.

5. On each device (phone, laptop): fully close and reopen the app, then sign
   in with the account from step 3. Check the header pill reads **Synced** and
   your data is there.
   - "Use this device only" skips sign-in: the device's data stays usable and
     syncs after you sign in from Settings, Data and sync.

## Part 3: publish the rules (you, about 2 minutes)

Only after every device you use has signed in (step 5).

6. **Mark yourself as the owner.** Realtime Database, Data. Hover the root,
   **+**, key `owners`. Under it add key = your **User UID** from step 3,
   value = `true` (boolean, not the text "true").
7. **Publish.** Realtime Database, Rules. Double-click into the editor to
   focus it, select all, paste the whole of `firebase-rules.json`, Publish.
8. **Check from the app:** reload, pill reads Synced, add and delete a
   throwaway task.
9. **Check it is locked.** Open these in a private browser window; each must
   say `Permission denied`:
   - `https://lifestack-d5300-default-rtdb.firebaseio.com/profiles.json`
   - `https://lifestack-d5300-default-rtdb.firebaseio.com/users/chinmay.json`
   - `https://lifestack-d5300-default-rtdb.firebaseio.com/external/steps.json`

If anything is wrong after step 7: paste `firebase-rules-interim.json` back
and Publish. You are back where you started.

---

## What keeps working without changes

| Writer | Path | Why it still works |
|---|---|---|
| iPhone Health Shortcut | `external/<metric>/<date>`, `external/workouts`, `external/lastSync` | Writes stay open, as in the interim rules. Only reads are locked. |
| GitHub calendar Action | `external/calendar` | Same. |
| Tester form (`report.html`) | `inbox` | Anyone can still *file* a report; only you can read, triage or delete them. |

## Stage 2 (later, optional)

The Shortcut and the calendar Action can still *write* without credentials, so
a stranger could add fake health numbers (not read or delete). Closing that
means giving each a credential (a database secret on the Shortcut URLs, or a
sign-in step), then tightening those four `.write` rules. Not needed for
privacy; worth doing eventually.

## What the app does (for whoever works on it next)

- `js/firebase-sync.js` `requireSignIn()` runs before the profile picker and
  before any database read or write. `js/app.js` chains
  `requireSignIn -> requireProfile -> initFirebaseSync`.
- Signed out ("Use this device only") sets `cloudSignedOut`, which takes the
  same local-only path as a session with no SDK. Nothing is lost; the next
  signed-in load pushes the newer local data up.
- Settings, Data and sync shows the signed-in email with Sign out, or Sign in.
- The tester inbox watch starts after sign-in (it is owner-only under the rules).
- Verified with a fake Firebase SDK (no network): no database call happens
  before sign-in, wrong password, sign out, use-this-device-only, and signing
  back in pushes the offline edit.
