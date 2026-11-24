#!/usr/bin/env python3
"""Catalog-level fingerprint of an app's schemas, for comparing an original single-app
database with the consolidated platform database.

Structure (tables, columns, constraints, indexes, policies, triggers, grants) is read
with search_path set to the app's own schemas, so Postgres prints names unqualified on
both sides and no text substitution is needed. Function bodies and settings are stored
text; the original side is mapped with the converter's rules so the diff shows any
change the converter made beyond the intended schema rename.

usage: fingerprint.py <db> <schemas,comma> [--map-from-original <target_schema> <old=new,...>]
"""
import subprocess
import sys

sys.path.insert(0, __import__("os").path.join(__import__("os").path.dirname(__file__), ".."))
from convert import convert  # noqa: E402

db, schemas = sys.argv[1], sys.argv[2].split(",")
mapping = None
if len(sys.argv) > 3 and sys.argv[3] == "--map-from-original":
    target = sys.argv[4]
    renames = dict(kv.split("=") for kv in sys.argv[5].split(",") if kv) if len(sys.argv) > 5 else {}
    mapping = (target, renames)

sp = ", ".join(schemas + ["extensions"])
nsp = ", ".join(f"'{s}'" for s in schemas)

Q = rf"""
SET search_path TO {sp};
WITH ns AS (SELECT oid FROM pg_namespace WHERE nspname IN ({nsp}))
SELECT 'T|' || c.relname || '|' || c.relkind::text || '|rls=' || c.relrowsecurity || '|force=' || c.relforcerowsecurity
       || '|acl=' || coalesce(c.relacl::text, '')
FROM pg_class c WHERE c.relnamespace IN (SELECT oid FROM ns) AND c.relkind IN ('r','v','m','S','p','f')
UNION ALL
SELECT 'C|' || c.relname || '|' || a.attnum || '|' || a.attname || '|' || format_type(a.atttypid, a.atttypmod)
       || '|nn=' || a.attnotnull || '|def=' || coalesce(pg_get_expr(d.adbin, d.adrelid), '') || '|acl=' || coalesce(a.attacl::text, '')
FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
WHERE c.relnamespace IN (SELECT oid FROM ns) AND c.relkind IN ('r','v','m','p') AND a.attnum > 0 AND NOT a.attisdropped
UNION ALL
SELECT 'K|' || c.relname || '|' || k.conname || '|' || pg_get_constraintdef(k.oid)
FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid WHERE c.relnamespace IN (SELECT oid FROM ns)
UNION ALL
SELECT 'I|' || regexp_replace(pg_get_indexdef(i.indexrelid), ' ON (ONLY )?[a-z_]+\.', ' ON \1')
FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE c.relnamespace IN (SELECT oid FROM ns)
UNION ALL
SELECT 'P|' || c.relname || '|' || p.polname || '|' || p.polcmd::text || '|perm=' || p.polpermissive
       || '|roles=' || array_to_string(ARRAY(SELECT CASE WHEN r = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(r) END FROM unnest(p.polroles) r ORDER BY 1), ',')
       || '|using=' || coalesce(pg_get_expr(p.polqual, p.polrelid), '') || '|check=' || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')
FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid WHERE c.relnamespace IN (SELECT oid FROM ns)
UNION ALL
SELECT 'G|' || regexp_replace(pg_get_triggerdef(t.oid), ' ON [a-z_]+\.', ' ON ')
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid WHERE c.relnamespace IN (SELECT oid FROM ns) AND NOT t.tgisinternal
UNION ALL
SELECT 'V|' || c.relname || '|' || pg_get_viewdef(c.oid)
FROM pg_class c WHERE c.relnamespace IN (SELECT oid FROM ns) AND c.relkind IN ('v','m')
UNION ALL
SELECT 'Y|' || t.typname || '|' || t.typtype::text || '|' || coalesce((SELECT string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid = t.oid), '')
FROM pg_type t WHERE t.typnamespace IN (SELECT oid FROM ns) AND t.typtype IN ('e','d','c') AND NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.oid = t.typrelid AND c.relkind <> 'c')
;
"""

QF = f"""
SET search_path TO {sp};
SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' || E'\\x1f' ||
       pg_get_function_result(p.oid) || '|secdef=' || p.prosecdef || '|vol=' || p.provolatile::text || '|lang=' || l.lanname
       || '|acl=' || coalesce(p.proacl::text, '') || E'\\x1f' || coalesce(array_to_string(p.proconfig, ';'), '') || E'\\x1f' || p.prosrc
FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
WHERE p.pronamespace IN (SELECT oid FROM pg_namespace WHERE nspname IN ({nsp}));
"""


def run(q: str, sep: str) -> list:
    out = subprocess.run(["sudo", "-u", "postgres", "psql", "-At", "-q", "-R", sep, "-d", db, "-c", q],
                         capture_output=True, text=True)
    if out.returncode: sys.exit(out.stderr)
    out = out.stdout
    return [x.strip() for x in out.split(sep) if x.strip()]


lines = sorted(run(Q, "\x1e"))
funcs = []
for row in run(QF, "\x1e"):
    sig, meta_cfg_src = row.split("\x1f", 1)
    meta, cfg, src = meta_cfg_src.split("\x1f", 2)
    if mapping:
        cfg = convert("SET search_path = " + cfg.replace("search_path=", ""), *mapping)[len("SET search_path = "):] \
            if cfg.startswith("search_path=") else cfg
        src = convert(src, *mapping)
    else:
        cfg = cfg.replace("search_path=", "")
    funcs.append(f"F|{sig}|{meta}|cfg={cfg}\n{src.strip()}\n")
for l in lines:
    print(l.replace("\n", "\\n"))
for f in sorted(funcs):
    print(f)
