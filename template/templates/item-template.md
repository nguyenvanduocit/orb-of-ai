---
template_path: templates/item-template.md
document_type: item
sections:
  - "*"
  - relationships
fields:
  $path:
    pattern: "^content/(en/)?guides/.+\\.md$"
  template:
    required: true
    pattern: "^templates/item-template\\.md$"
  document_type:
    required: true
    enum: [item]
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
  rarity:
    required: true
    enum: [unique, rare-base, currency, divination-card, jewel, flask, system]
  item_class:
    required: true
  league:
    required: true
    pattern: "^\\d+\\.\\d+(\\.\\d+)?$"
  patch:
    required: true
    pattern: "^\\d+\\.\\d+(\\.\\d+)?$"
---

# [Item Name]

<!--
Item cheat sheet — format chuẩn: templates/content-style.md. Body ≤ 50 dòng.
REQUIRED: mở đầu 1-2 dòng + Stats (tooltip nguyên văn) + Why it matters.
OPTIONAL: Build usage · Acquisition · Version History · Relationships.
-->

(1-2 dòng: item gì + build/archetype nào xoay quanh nó.)

## Stats

```
[Item Name]
[Base Type]
[Implicit]
--------
[Explicit mods, nguyên văn tooltip]
```

## Why it matters

- [interaction/synergy item mở ra] → [hệ quả build] — kèm math nếu có
- `Exclusion check: <none | list>` (disable/require keystone nào)

## Build usage

- [build/archetype] dùng làm [vai trò] — [link build doc]

## Acquisition

- Nguồn: [boss/area/target-farm được không] · Giá: ~X (YYYY-MM-DD, nguồn) · trend

## Version History

- Patch X.Y.Z: [delta ảnh hưởng power level]

## Relationships

```yaml section-rules
required: false
list:
  items:
    pattern: "^(synergizes_with|related|related_mechanics|related_builds|related_guides|requires|used_by|references|derived_from|derived_builds|source_research|competes_with|alternative_to|supports|farming_relevance|part_of|parent|follows_build) "
```

- **predicate** [Title](/route) — reason
