#!/usr/bin/env python3
"""Check the maintained PRD map, local links and stable identifiers. No dependencies."""
from pathlib import Path
from urllib.parse import unquote, urlsplit
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
PRD = ROOT / 'docs/prd'
MODULES = sorted(PRD.glob('*.md'))
ENTRYPOINTS = [ROOT / p for p in (
    'README.md', 'AGENTS.md', 'PLAN.md',
    'docs/plans/ANIMATION_PLAN.md', 'docs/plans/MAIN_LOGIC_PLAN.md',
    'docs/verification/prd-v37-migration.md',
)]
errors = []
cache = {}

def plain_markdown(text):
    return re.sub(r'^(`{3,}|~{3,})[^\n]*\n.*?^\1\s*$', '', text, flags=re.M | re.S)

def anchors(path):
    if path in cache:
        return cache[path]
    text = plain_markdown(path.read_text())
    explicit = re.findall(r'<a\s+id="([^"]+)"', text)
    if len(explicit) != len(set(explicit)):
        errors.append(f'{path.relative_to(ROOT)}: duplicate explicit anchor')
    result = set(explicit)
    slugs = {}
    for title in re.findall(r'^#{1,6}\s+(.+?)\s*#*$', text, flags=re.M):
        title = re.sub(r'<[^>]+>', '', title).replace('`', '')
        slug = re.sub(r'[^\w\-\s]', '', title.lower()).replace(' ', '-')
        number = slugs.get(slug, 0)
        slugs[slug] = number + 1
        result.add(slug + (f'-{number}' if number else ''))
    cache[path] = result
    return result

count = 0
for path in MODULES + ENTRYPOINTS:
    if not path.is_file():
        errors.append(f'Missing file: {path.relative_to(ROOT)}')
        continue
    text = path.read_text()
    if len(re.findall(r'^```', text, flags=re.M)) % 2:
        errors.append(f'{path.relative_to(ROOT)}: unclosed fenced block')
    text = plain_markdown(text)
    anchors(path)
    definitions = dict(re.findall(r'^\[([^\]]+)\]:\s*(\S+)', text, flags=re.M))
    targets = re.findall(r'\]\(([^\s)]+)(?:\s+"[^"]*")?\)', text)
    targets += list(definitions.values())
    for key in re.findall(r'\[[^\]\n]+\]\[([^\]]+)\]', text):
        if key not in definitions:
            errors.append(f'{path.relative_to(ROOT)}: undefined reference {key}')
    for raw in targets:
        target = urlsplit(raw.strip('<>'))
        if target.scheme or target.netloc:
            continue
        dest = (path.parent / unquote(target.path)).resolve() if target.path else path
        if not dest.is_relative_to(ROOT):
            errors.append(f'{path.relative_to(ROOT)}: link escapes repository: {raw}')
            continue
        if not dest.exists():
            errors.append(f'{path.relative_to(ROOT)}: missing target: {raw}')
            continue
        if target.fragment and dest.suffix == '.md' and unquote(target.fragment) not in anchors(dest):
            errors.append(f'{path.relative_to(ROOT)}: missing anchor: {raw}')
        count += 1

map_text = (PRD / 'README.md').read_text()
for path in MODULES:
    if path.name != 'README.md' and f']({path.name})' not in map_text:
        errors.append(f'PRD map does not list {path.name}')

explicit_owners = {}
for path in MODULES:
    for anchor in re.findall(r'<a id="([^"]+)"', path.read_text()):
        if anchor in explicit_owners:
            errors.append(f'PRD anchor {anchor} repeated in {path.name} and {explicit_owners[anchor]}')
        explicit_owners[anchor] = path.name

dialogue = (PRD / '11-dialogue.md').read_text()
ids = re.findall(r'^\| (DLG-[A-Z]+\d+) \|', dialogue, flags=re.M)
if len(ids) != len(set(ids)):
    errors.append('Duplicate dialogue candidate IDs')

if errors:
    print('\n'.join(errors), file=sys.stderr)
    sys.exit(1)
print(f'PASS: {len(MODULES)} PRD documents; {count} local links; '
      f'{len(explicit_owners)} unique explicit anchors; {len(ids)} dialogue candidates.')
