# Signup Session Storyboards And Test Scenarios

## Storyboard Scenarios

### 1. Admin invites a new person without losing their session
- **Actor:** Church owner or admin.
- **Starting state:** Admin is signed in to People.
- **Story:** Admin opens Team settings, creates an invitation for a new member or admin, and sends/copies the invite link.
- **Expected experience:** Admin remains signed in as the same admin account after the invitation is created.
- **Must not happen:** Admin is signed out, redirected to the invited account, or given an impersonation-style session.

### 2. Admin opens an invite link for another email
- **Actor:** Church owner or admin.
- **Starting state:** Admin is signed in as `admin@example.com`.
- **Story:** Admin clicks or pastes an invitation link intended for `newuser@example.com`.
- **Expected experience:** The app blocks account acceptance in the current browser session and tells the admin to use a private window or sign out.
- **Must not happen:** The current admin session is replaced by `newuser@example.com`.

### 3. Invited user accepts their own invitation
- **Actor:** Invited user.
- **Starting state:** User is not signed in, or is signed in as the same invited email.
- **Story:** User opens their invitation link, enters profile details and password, then submits.
- **Expected experience:** If Supabase returns a session immediately, the browser becomes the invited user session and redirects to the right authenticated home. If email verification is required, the user sees the verification message.
- **Must not happen:** Another signed-in account is silently switched or impersonated.

### 4. Normal visitor creates their own account
- **Actor:** Normal user/member.
- **Starting state:** User is not signed in.
- **Story:** User opens `/signup`, enters email and password, and submits.
- **Expected experience:** If Supabase returns a session immediately, the browser becomes the new account session. If email verification is required, the user sees the verification message.
- **Must not happen:** An existing admin or unrelated session is reused for the new account.

### 5. Signed-in user attempts self-signup again
- **Actor:** Any already signed-in user.
- **Starting state:** User is signed in.
- **Story:** User visits `/signup` directly and tries to create a different account.
- **Expected experience:** The app refuses the action and tells them to sign out or use a private window.
- **Must not happen:** The current session is cleared automatically.

## Testing Scenarios

### A. Admin invitation creation preserves admin session
1. Sign in as an owner/admin.
2. Open Team settings.
3. Create an invitation for a different email.
4. Confirm the invitation is created successfully.
5. Navigate to `/dashboard`.
6. Confirm the signed-in account is still the original admin.

**Expected result:** Admin remains authenticated as the original account.

### B. Different signed-in account cannot accept invite
1. Sign in as `admin@example.com`.
2. Open an invite link for `newuser@example.com` in the same browser session.
3. Fill the signup form and submit.

**Expected result:** The app shows a blocking message instructing the user to use a private window or sign out. The admin session remains active.

### C. Same invited account can accept invite
1. Sign in as the same email used by the invitation.
2. Open that account's invite link.
3. Fill profile fields and submit the existing password.

**Expected result:** Invitation is accepted for the signed-in account, profile linking completes, and the user is redirected to their authenticated home.

### D. Unauthenticated invite acceptance
1. Open an invite link in a private browser window.
2. Fill profile fields and create a password.
3. Submit the form.

**Expected result:** The user is either redirected as the new account if a session is issued, or shown an email verification message if verification is required.

### E. Unauthenticated self-signup
1. Open `/signup` in a private browser window.
2. Enter a valid email and password.
3. Submit the form.

**Expected result:** The user is either redirected as the new account if a session is issued, or shown an email verification message if verification is required.

### F. Signed-in self-signup is blocked
1. Sign in as any account.
2. Open `/signup`.
3. Try to create a new account with another email.

**Expected result:** The app blocks the action and keeps the original session active.

## Regression Checks

- Signup actions must not call `auth.signOut()` automatically during account creation.
- Admin invitation creation must not call any user-session switching function.
- Invitation acceptance may sign in only as the invitation email.
- A browser session must never silently change from one email identity to another.
- Use a private window when testing new-account creation from an already signed-in admin workstation.
