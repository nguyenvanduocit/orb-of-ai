---
template_path: templates/character-progress-template.md
document_type: character-progress
sections:
  - "*"
  - relationships
fields:
  $path:
    pattern: "^content/(en/)?characters/.+\\.md$"
  template:
    required: true
    pattern: "^templates/character-progress-template\\.md$"
  document_type:
    required: true
    enum: [character-progress]
  title:
    required: true
  status:
    required: true
    enum: [leveling, mapping, endgame, retired, rerolled]
  created:
    required: true
    pattern: "^\\d{4}-\\d{2}-\\d{2}$"
  updated:
    required: true
    pattern: "^\\d{4}-\\d{2}-\\d{2}$"
  character_name:
    required: true
  character_class:
    required: true
    enum: [Marauder, Duelist, Ranger, Shadow, Witch, Templar, Scion, Warrior, Mercenary, Monk, Sorceress, Huntress, Druid]
  ascendancy:
    required: true
  league:
    required: true
    pattern: "^\\d+\\.\\d+(\\.\\d+)?$"
  patch:
    required: true
    pattern: "^\\d+\\.\\d+(\\.\\d+)?$"
  current_progress:
    required: true
    enum: [campaign, white-maps, yellow-maps, red-maps, t16-farming, endgame-bosses, uber-content]
---

# [Character Name] - Progress Tracker

<!--
Character tracking cheat sheet — format chuẩn: templates/content-style.md. Body ≤ 50 dòng.
Snapshot LUÔN từ live fetch: `.claude/skills/pob/scripts/pob.sh fetch "<charname>" [--spectre "<type>"]` —
fetch timestamp bắt buộc ngay dưới heading Snapshot. DPS ≥ 100k kèm derivation/PoB link.
REQUIRED: mở đầu 1 dòng + Snapshot + Goals + Log. Log reverse-chrono, 1-3 bullet delta/ngày.
-->

(1 dòng: class/asc/level + stage + goal chính.)

## Snapshot

Last fetch: YYYY-MM-DD via pob.sh fetch <charname>

- **Life/ES:** X/X · **EHP:** X · **Armour/Eva:** X/X · **Block:** X%
- **Res:** F X / C X / L X / Chaos X · **Max hit:** Phys X / …
- **DPS:** X ([derivation]) · **MS:** X%

## Goals

1. [goal cụ thể, priority order — completable, kèm expected outcome]
2. …

## Gear

- Bottleneck: [slot] — cần [mod] · **Biggest upgrade:** [X]

## Progress Log

### YYYY-MM-DD
- (1-3 bullet: làm gì, drop gì, upgrade nào)

## Relationships

```yaml section-rules
required: false
list:
  items:
    pattern: "^(synergizes_with|related|related_mechanics|related_builds|related_guides|requires|used_by|references|derived_from|derived_builds|source_research|competes_with|alternative_to|supports|farming_relevance|part_of|parent|follows_build) "
```

- **predicate** [Title](/route) — reason (tối thiểu: build doc character đang chạy)
