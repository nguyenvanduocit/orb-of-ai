---
template_path: templates/skill-template.md
document_type: skill
sections:
  - "*"
  - relationships
fields:
  $path:
    pattern: "^content/(en/)?guides/.+\\.md$"
  template:
    required: true
    pattern: "^templates/skill-template\\.md$"
  document_type:
    required: true
    enum: [skill]
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
  gem_color:
    required: true
    enum: [red, green, blue, white, prismatic]
  skill_type:
    required: true
    enum: [active, support, "exceptional support", trigger, vaal]
  league:
    required: true
    pattern: "^\\d+\\.\\d+(\\.\\d+)?$"
  patch:
    required: true
    pattern: "^\\d+\\.\\d+(\\.\\d+)?$"
---

# [Skill Name]

<!--
Skill cheat sheet — format chuẩn: templates/content-style.md. Body ≤ 50 dòng.
REQUIRED: mở đầu 1-2 dòng + Mechanics + Scaling. OPTIONAL: Links · Builds · Relationships.
DPS claim ≥ 100k kèm derivation/PoB link.
-->

(1-2 dòng: skill làm gì + gem color/type + playstyle.)

## Mechanics

- [targeting/projectile/AoE/trigger behavior] — số quan trọng: [damage effectiveness, hit rate, duration]
- `Exclusion check: <none | list>` (one-way block như Avatar of Fire)

## Scaling

- **Primary:** [stat] → **Secondary:** [stat] → **Unique:** [ailment/stacking interaction]

## Links

- **6L:** [Skill] + [S1..S5] — mỗi support 1 mệnh đề why
- **Budget 4L:** [Skill] + [S1..S3] · drop trước: [support]
- Gem level/quality breakpoint: [X]

## Builds

- [ascendancy/archetype] — [link build doc]

## Relationships

```yaml section-rules
required: false
list:
  items:
    pattern: "^(synergizes_with|related|related_mechanics|related_builds|related_guides|requires|used_by|references|derived_from|derived_builds|source_research|competes_with|alternative_to|supports|farming_relevance|part_of|parent|follows_build) "
```

- **predicate** [Title](/route) — reason
