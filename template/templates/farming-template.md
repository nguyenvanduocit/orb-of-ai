---
template_path: templates/farming-template.md
document_type: farming-strategy
sections:
  - "*"
  - relationships
fields:
  $path:
    pattern: "^content/(en/)?farming/.+\\.md$"
  template:
    required: true
    pattern: "^templates/farming-template\\.md$"
  document_type:
    required: true
    enum: [farming-strategy]
  title:
    required: true
  status:
    required: true
    enum: [draft, active, outdated, archived]
  created:
    required: true
    pattern: "^\\d{4}-\\d{2}-\\d{2}$"
  updated:
    required: true
    pattern: "^\\d{4}-\\d{2}-\\d{2}$"
  strategy_tier:
    required: true
    enum: [S, A, B, C, Niche, Experimental]
  investment_tier:
    required: true
    enum: [Low, Medium, High, Variable]
  league:
    required: true
    pattern: "^\\d+\\.\\d+(\\.\\d+)?$"
  patch:
    required: true
    pattern: "^\\d+\\.\\d+(\\.\\d+)?$"
  league_phase:
    required: true
    enum: [Early, Mid, Late, End]
  confidence_level:
    required: true
    enum: [High, Medium, Low]
---

# [Strategy Name]

<!--
Farming cheat sheet (POE2 0.5+ Atlas) — format chuẩn: templates/content-style.md. Body ≤ 60 dòng.
REQUIRED: mở đầu 1-2 dòng (farm gì, ra tiền từ đâu, tier + div/h + ngày) + Setup + Profit math +
  Failure Modes (literal, validator). OPTIONAL: Gameplay · Optimization · Alternatives · Changelog.
Vocabulary POE2: Waystone, Precursor Tablet (slot theo mod count waystone: 1-2=1, 3-5=2, 6+=3;
  City biome + Industrial Improvements → slot 4), Precursor Tower (nguồn rớt tablet, không phải nơi cắm),
  Atlas Passive Tree + mechanic subtree, Masters of the Atlas, fragment. KHÔNG có scarab. Currency: ex nền, div high-end.
Mọi số market kèm timestamp + nguồn (poe2scout/poe-ninja snapshot/trade query). Snapshot >7 ngày → re-fetch trước khi quote.
-->

(1-2 dòng: farm content gì → drop nào ra tiền. `Tier X · investment Y · ~Z div/h (YYYY-MM-DD)`.)

## Setup

- **Atlas tree:** [cluster/node chính] — why · subtree: [node]
- **Masters:** [master + bonus]
- **Tablets:** [loadout] — why từng cái
- **Waystone:** T[X] + [biome] — [layout/density reason]
- **Build floor:** [DPS/clear speed/survivability tối thiểu]

## Profit math

```
profit/h = (drop_rate × stack × price) × maps/h − cost/map
```

- [item] X/map × [giá] (YYYY-MM-DD, nguồn) → ~Y div/h
- Cost/map: [tablet/waystone/fragment]

## Gameplay

- [thứ tự trong map: activate gì → clear order → nhặt gì / bỏ gì → khi nào rời]

## Failure Modes

```yaml section-rules
required: true
```

(≥3 bullet `nguyên nhân → hậu quả`: saturation (giá compress khi nào) · sustain fail · build floor · patch nerf · break-even.)

## Changelog

### YYYY-MM-DD
- (1-3 bullet delta)

## Relationships

```yaml section-rules
required: false
list:
  items:
    pattern: "^(synergizes_with|related|related_mechanics|related_builds|related_guides|requires|used_by|references|derived_from|derived_builds|source_research|competes_with|alternative_to|supports|farming_relevance|part_of|parent|follows_build) "
```

- **predicate** [Title](/route) — reason
