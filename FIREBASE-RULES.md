# Firebase security rules

The database currently has **no rules**. It is world-readable, world-writable
and world-deletable by anyone who has the URL — and the URL is in this repo.

I cannot apply these for you. Writing rules needs Firebase console access, and
the app authenticates with nothing but a public config, so there is no
credential here that could do it. Both files below are paste-ready.

---

## Step 1 — interim hardening (do this now, ~2 minutes)

`firebase-rules-interim.json`

1. Firebase console → **Realtime Database** → **Rules**
2. Replace everything in the editor with the contents of that file
3. **Publish**

Nothing breaks. Nothing in it requires authentication, so the app and the
iPhone Health Shortcuts keep working exactly as they do today.

**What it stops**

- **Wholesale deletion.** Every write must leave data behind, so a DELETE, a
  null write, or a `{}` overwrite is refused. This is the "someone wipes all my
  health data" case.
- Destruction of the frozen pre-profiles backup at `/lifestack`, now read-only.
- Junk in the shared food bank — shape and range validated.
- Garbage dates or non-numeric values in the health node.

**What it does not stop**

- **Reading.** Your data stays publicly readable to anyone with the URL. Only
  real auth fixes that.
- Overwriting a value with different-but-valid data.

It is a seatbelt, not a lock.

**Validated against the live database on 2026-08-11** — these rules accept
every shape currently in it, and accept every write the app actually makes:

| Path | Live shape | Verdict |
|---|---|---|
| `profiles` | `{"chinmay": "Chinmay"}` | passes |
| `users/<id>` | object with children | passes |
| `external/*/<date>` | all numeric, all ≥ 0 | passes |
| `foodBank` | 32 entries, all have `name` + `calories`, zero unexpected keys | passes |
| `lifestack` | legacy backup | becomes read-only |

"Start fresh (erase this profile)" was specifically checked: it writes a
starter object rather than deleting, so the no-delete rule does not break it.

---

## Step 2 — real auth (when you have an hour)

`firebase-rules.json`

This is the version that actually stops strangers reading your data, but it
requires Firebase Auth in the app first. **Do the prerequisites before pasting
or you will lock yourself out.** They are listed in the file header:

1. Enable a sign-in provider. Anonymous is not enough on its own — anyone can
   mint an anonymous token, so it only deters casual scraping.
2. Sign in once, copy your uid.
3. Create `profileOwners/chinmay = "<your-uid>"` by hand. This binds the named
   profile to an account **without moving `users/chinmay`**, which must not be
   migrated.
4. Append `?auth=<DATABASE_SECRET>` to every URL in the Health Shortcuts.
   Legacy, but it is the only practical way for a Shortcut to authenticate.

---

## A defect I fixed in both files

They previously carried a `_comment` key as a sibling to `"rules"`. Firebase
rejects unknown top-level keys, so **both files would have failed on paste**
with `Unknown key: _comment`. The notes are now `//` comments, which the rules
editor accepts. Both files were re-parsed after the change to confirm they are
valid JSON with `rules` as the only top-level key.
