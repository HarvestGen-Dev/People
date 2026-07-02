# Account onboarding contract

<!-- AGENT: INTEGRATION -->

People distinguishes tenant dashboard authorization from congregant profile
access.

## CSV profile import

Administrators import profiles through `/people/new`. The server resolves
`church_id`; clients must never supply it.

```csv
first_name,last_name,email,phone,status,campus,allow_self_claim
Jamie,Tan,jamie@example.com,0123456789,active,Bandar Sunway,true
Alex,Lee,alex@example.com,0199991111,visitor,Bandar Sunway,false
```

- Email addresses are trimmed and lowercased.
- Re-importing the same church/email updates the existing profile.
- An email-bearing row defaults to `allow_self_claim=true`.
- `allow_self_claim=false` routes a verified signup to manager approval.
- CSV import never creates `owner`, `admin`, or dashboard `member` access.

## Verified profile claim

1. A person signs up at `/signup` with the imported email.
2. Supabase verifies ownership of that email.
3. `/auth/callback` invokes `claim_person_profile()` as the authenticated user.
4. One eligible unclaimed match creates `person_user_links`.
5. Disabled or ambiguous matches create `person_claim_requests`.
6. No match redirects to `/claim-pending`.

Claim statuses are:

- `claimed`
- `approval_required`
- `no_match`
- `already_claimed`
- `verification_required`

Portal users are routed to `/portal` and may read only their linked person row.

## Staff and owner invitations

Church invitations are email-bound, single-use, hashed at rest, expiring, and
revocable.

- Platform administrator → owner
- Church owner → administrator
- Church owner or administrator → dashboard member

The creation response contains the raw link once so the UI can email it, copy
it, or generate a QR code. Resending rotates the token and revokes the previous
link.

Example church staff request:

```json
{
  "email": "staff@example.com",
  "role": "member",
  "expires_in_days": 7
}
```

Example platform owner request:

```json
{
  "church_id": "00000000-0000-0000-0000-000000000001",
  "email": "owner@example.com",
  "expires_in_days": 7
}
```

## Edge cases

- Existing Auth account: enter the current password on the invitation signup
  page; the membership is added without creating another Auth user.
- Shared email within one church: rejected by normalized email uniqueness.
- Same email across churches: requires administrator review.
- Already claimed profile: no second link is created.
- Concurrent claims: the person row is locked and uniqueness constraints allow
  only one account link.
- Revoked, expired, accepted, or wrong-email invitation: rejected.

## Platform bootstrap

Migration `014` promotes the existing installation's earliest church owner as
the initial platform administrator. To add another platform administrator
explicitly:

```sql
INSERT INTO platform_admins (user_id)
SELECT id
FROM auth.users
WHERE LOWER(email) = LOWER('platform-owner@example.com');
```

Subsequent platform access is controlled by `platform_admins`, never by client
metadata.
