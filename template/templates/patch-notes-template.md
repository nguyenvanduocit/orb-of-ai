---
template_path: templates/patch-notes-template.md
document_type: patch-notes
sections:
  - "*"
  - relationships
fields:
  $path:
    pattern: "^content/(en/)?guides/.+\\.md$"
  template:
    required: true
    pattern: "^templates/patch-notes-template\\.md$"
  document_type:
    required: true
    enum: [patch-notes]
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

# [Expansion Name]

<!--
Patch-notes archive — EXCEPTION duy nhất của content-style.md: body là changelog VERBATIM
(bản dịch tiếng Việt của patch note GGG chính thức), KHÔNG nén, KHÔNG paraphrase, KHÔNG bình luận.
Lý do: đây là source data để tra exact wording; bản digest là doc mechanic riêng.
- Title: tên expansion + "Patch Notes", không kèm số patch (frontmatter `patch` là identity).
- H2 = đúng category của patch note gốc (League / Endgame / Skill / Unique / Bug Fix …).
- Slug filename GIỮ patch prefix (vd `0-5-0-patch-notes.md`).
- Intro 1-3 dòng: nguồn (GGG, ngày đăng, URL), link raw `data/release-notes/...`, link doc digest.
-->

(Intro: nguồn + ngày + URL gốc + link raw + link digest doc.)

## [Category 1]

- (nguyên văn bản dịch)

## [Category N]

- (…)

## Relationships

```yaml section-rules
required: false
list:
  items:
    pattern: "^(synergizes_with|related|related_mechanics|related_builds|related_guides|requires|used_by|references|derived_from|derived_builds|source_research|competes_with|alternative_to|supports|farming_relevance|part_of|parent|follows_build) "
```

- **predicate** [Title](/route) — reason (digest doc + mechanic/build chịu tác động lớn)
