---
template_path: templates/guide-template.md
document_type: guide
sections:
  - "*"
  - relationships
fields:
  $path:
    pattern: "^content/(en/)?guides/.+\\.md$"
  template:
    required: true
    pattern: "^templates/guide-template\\.md$"
  document_type:
    required: true
    enum: [guide]
  title:
    required: true
  status:
    required: true
    enum: [draft, review, published, outdated]
  created:
    required: true
    pattern: "^\\d{4}-\\d{2}-\\d{2}$"
  updated:
    required: true
    pattern: "^\\d{4}-\\d{2}-\\d{2}$"
  league:
    required: true
    pattern: "^\\d+\\.\\d+(\\.\\d+)?$"
  patch:
    required: true
    pattern: "^\\d+\\.\\d+(\\.\\d+)?$"
---

# [Guide Title]

<!--
Guide cheat sheet (tutorial tuần tự) — format chuẩn: templates/content-style.md. Body ≤ 50 dòng.
REQUIRED: mở đầu 1-2 dòng (làm được gì + prerequisite) + các bước.
Mỗi bước = heading ngắn + bullets `hành động → kết quả`, key decision ghi thẳng trong bước.
Tips/pitfalls gói vào bước liên quan; chỉ tách section khi cross-cutting.
KHÔNG Quick Summary/Overview. Cross-link → Relationships.
-->

(1-2 dòng: guide cho việc gì + prerequisite.)

## [Bước 1]

- [hành động] → [kết quả] · decision: [chọn gì khi nào]

## [Bước N]

- …

## Pitfalls

- ✗ [lỗi] → [cost] · ✓ [cách đúng]

## Relationships

```yaml section-rules
required: false
list:
  items:
    pattern: "^(synergizes_with|related|related_mechanics|related_builds|related_guides|requires|used_by|references|derived_from|derived_builds|source_research|competes_with|alternative_to|supports|farming_relevance|part_of|parent|follows_build) "
```

- **predicate** [Title](/route) — reason
