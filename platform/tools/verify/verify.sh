#!/bin/bash
# Rebuild each app's ORIGINAL migrations and the consolidated platform chain on a local
# Postgres, then compare every app's structure object by object.
# usage: tools/verify/verify.sh <dir containing people-hg, HG-Claims, lms-hg, drip-n-brew>
# needs: local Postgres 15+ with contrib (pgcrypto, uuid-ossp, pg_trgm), run as a user who can sudo -u postgres
set -euo pipefail
SRC=${1:?path to the folder that contains the four app repos}
HERE=$(cd "$(dirname "$0")" && pwd); PLATFORM=$(cd "$HERE/../.." && pwd)
STUB=/tmp/hg_supabase_stub.sql; cp "$HERE/supabase_stub.sql" $STUB; chmod 644 $STUB
"$HERE/apply.sh" orig_peoplehg $STUB "$SRC/people-hg/supabase/migrations"
"$HERE/apply.sh" orig_hgclaims $STUB "$SRC/HG-Claims/supabase/migrations"
"$HERE/apply.sh" orig_lmshg    $STUB "$SRC/lms-hg/supabase/migrations"
"$HERE/apply.sh" orig_dripnbrew $STUB "$SRC/drip-n-brew/supabase/migrations"
"$HERE/apply.sh" platform      $STUB "$PLATFORM/supabase/migrations"
OUT=$(mktemp -d); F="python3 $HERE/fingerprint.py"
$F orig_peoplehg public --map-from-original people ""                          > $OUT/people.o; $F platform people                > $OUT/people.n
$F orig_hgclaims public,private --map-from-original claims "private=claims_private" > $OUT/claims.o; $F platform claims,claims_private > $OUT/claims.n
$F orig_lmshg public,app_private --map-from-original lms "app_private=lms_private"  > $OUT/lms.o;    $F platform lms,lms_private      > $OUT/lms.n
$F orig_dripnbrew public --map-from-original pos ""                            > $OUT/pos.o;    $F platform pos                   > $OUT/pos.n
for a in people claims lms pos; do
  echo "$a: $(diff <(grep -vE 'trgm|similarity|set_limit|show_limit' $OUT/$a.o | sed '/^$/d') \
                    <(grep -vE 'trgm|similarity|set_limit|show_limit' $OUT/$a.n | sed '/^$/d') | grep -c '^[<>]' || true) differing lines (details: diff $OUT/$a.o $OUT/$a.n)"
done
