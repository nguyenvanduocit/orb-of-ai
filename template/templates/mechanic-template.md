---
template_path: templates/mechanic-template.md
document_type: mechanic
sections:
  - "*"
  - version-history
  - relationships
fields:
  $path:
    pattern: "^content/(en/)?(guides|crafting)/.+\\.md$"
  template:
    required: true
    pattern: "^templates/mechanic-template\\.md$"
  document_type:
    required: true
    enum: [mechanic]
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
  league:
    required: true
    pattern: "^\\d+\\.\\d+(\\.\\d+)?$"
  patch:
    required: true
    pattern: "^\\d+\\.\\d+(\\.\\d+)?$"
---

# [Mechanic Name]

<!--
Mechanic cheat sheet — format chuẩn: templates/content-style.md. Body ≤ 50 dòng.
Số section khớp độ phức tạp: mechanic atomic → 2-3 section; league system → tối đa 6-7.
REQUIRED: mở đầu 1-2 dòng + 1 section cơ chế. OPTIONAL: toán/breakpoint · interactions ·
  anti-pattern (cái không hoạt động / lỗi tốn kém) · chi phí · Version History · Relationships.
Ambiguity chưa verify → ghi thẳng `chưa verify in-client: <điểm nghi>` một lần.
-->

(1-2 dòng: cơ chế là gì + build/ai đang dùng.)

## Cơ chế

- Trigger/điều kiện → hành vi → outcome, mỗi bước 1 bullet
- Số quan trọng: [base %, duration, cap, breakpoint] — nguồn (wiki/poedb/in-client test)

## Interactions

- [A] + [B] → [effect] — why (cơ chế underlying)
- `Exclusion check: <none | list>`

## Anti-patterns

- ✗ [kỳ vọng sai phổ biến] → thực tế [X], cost [Y]

## Version History

### Patch X.Y.Z
- (delta ảnh hưởng advice)

## Relationships

```yaml section-rules
required: false
list:
  items:
    pattern: "^(synergizes_with|related|related_mechanics|related_builds|related_guides|requires|used_by|references|derived_from|derived_builds|source_research|competes_with|alternative_to|supports|farming_relevance|part_of|parent|follows_build) "
```

- **predicate** [Title](/route) — reason
