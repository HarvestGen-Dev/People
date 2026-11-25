#!/bin/bash
# usage: apply.sh dbname stubfile migdir
db=$1; stub=$2; dir=$3
sudo -u postgres dropdb --if-exists $db >/dev/null; sudo -u postgres createdb $db
sudo -u postgres psql -q -v ON_ERROR_STOP=1 -d $db -f $stub >/dev/null 2>/tmp/stub_err || { cat /tmp/stub_err; exit 1; }
n=0
for f in $(ls $dir/*.sql | sort); do
  if ! out=$(sudo -u postgres psql -q -v ON_ERROR_STOP=1 -d $db --single-transaction -f $f 2>&1 >/dev/null); then
    echo "FAIL $(basename $f)"; echo "$out" | grep -E "ERROR|LINE" | head -4; exit 1; fi
  n=$((n+1))
done
echo "OK $db: $n migrations applied"
