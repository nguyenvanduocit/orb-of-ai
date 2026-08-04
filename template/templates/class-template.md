---
template_path: templates/class-template.md
document_type: class
sections:
  - "*"
  - relationships
fields:
  $path:
    pattern: "^content/(en/)?guides/.+\\.md$"
  template:
    required: true
    pattern: "^templates/class-template\\.md$"
  document_type:
    required: true
    enum: [class]
  title:
    required: true
  status:
    required: true
    enum: [draft, review, published, outdated, archived]
  created:
    required: true
    pattern: "^\\d{4}-\\d{2}-\\d{2}$"
  updated:
    required: true
    pattern: "^\\d{4}-\\d{2}-\\d{2}$"
  class_type:
    required: true
    enum: [Str, Dex, Int, "Str/Dex Hybrid", "Str/Int Hybrid", "Dex/Int Hybrid", "Tri-attribute Hybrid"]
  complexity:
    required: true
    enum: [low, medium, high]
  accessibility:
    required: true
    enum: [beginner-friendly, intermediate, advanced, all-content]
  league:
    required: true
    pattern: "^\\d+\\.\\d+(\\.\\d+)?$"
  patch:
    required: true
    pattern: "^\\d+\\.\\d+(\\.\\d+)?$"
---

# [Class Name]

<!--
Class cheat sheet — format chuẩn: templates/content-style.md. Body ≤ 50 dòng.
REQUIRED: mở đầu 1-2 dòng + Ascendancies + Archetypes.
-->

(1-2 dòng: class + vị trí tree + attribute + playstyle tự nhiên.)

## Tree position

- Start: [vùng tree] · base stats: [X] · cluster gần: [Y] → build accessible: [Z]

## Ascendancies

- **[Asc 1]:** [định vị 1 mệnh đề] · key nodes theo pick order: [A → B → C]
- **[Asc 2]:** …
- **[Asc 3]:** …

## Archetypes

- [archetype] — [asc dùng] — [1 mệnh đề playstyle] — [link build doc nếu có]

## League start

- Safest entry: [asc + build] — why

## Failure modes

- ✗ [content/scenario class yếu] → [why] (≥3 bullet: map mod · one-shot · gear floor · patch risk)

## Relationships

```yaml section-rules
required: false
list:
  items:
    pattern: "^(synergizes_with|related|related_mechanics|related_builds|related_guides|requires|used_by|references|derived_from|derived_builds|source_research|competes_with|alternative_to|supports|farming_relevance|part_of|parent|follows_build) "
```

- **predicate** [Title](/route) — reason
