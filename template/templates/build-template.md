---
template_path: templates/build-template.md
document_type: build
sections:
  - "*"
  - relationships
fields:
  $path:
    pattern: "^content/(en/)?builds/[^/]+/.+\\.md$"
  template:
    required: true
    pattern: "^templates/build-template\\.md$"
  document_type:
    required: true
    enum: [build]
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
  class:
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
  budget_tier:
    required: true
    enum: [league-starter, low-budget, medium-budget, high-budget, mirror-tier]
  confidence_level:
    required: false
    enum: [HIGH, MEDIUM, LOW]
  pob_coverage:
    required: false
    enum: [FULL, PARTIAL, NA]
---

# [Build Name]

<!--
Build cheat sheet — format chuẩn: templates/content-style.md. Body ≤ 120 dòng.
REQUIRED: mở đầu 1-2 dòng + Build Overview + Failure Modes (literal, validator) + Verdict (1-2 dòng).
OPTIONAL (omit khi không có fact): Skill Gems · Ascendancy · Passive Tree · Stats & Defenses ·
  Gear · Flasks · Leveling · Budget · Resources · Changelog · Relationships.
Mỗi fact một lần ở section sở hữu nó. Caveat PoB chưa model → frontmatter pob_coverage, không rải body.
POE2 không có Pantheon/Bandit. Title không kèm league/patch.
DPS/EHP claim ≥ 100k phải có PoB link hoặc math chain — không quote số trần.
-->

(1-2 dòng: build là gì — damage source + defense chính + content focus.)

## Build Overview

- **Damage:** [source] → scale qua [vector]
- **Defense:** [layer order]
- **Ràng buộc cứng:** [keystone/unique bắt buộc, exclusion]

## Skill Gems & Links

- **Main (6L):** [Skill] + [Support ×5] — mỗi support 1 mệnh đề why
- **Aura:** … · **Movement/Utility:** …
- `Exclusion check: <none | list>` (support category trùng, keystone one-way…)

## Ascendancy

- Thứ tự: [node 1] → [node 2] → … — mỗi node 1 mệnh đề why/unlock gì

## Passive Tree

- Keystone: [X] — why · Cluster chính: [Y] — why · PoB link cho allocation

## Stats & Defenses

(Số thật từ PoB/client, kèm ngày snapshot.)

- **Life/ES:** X/X · **EHP:** X · **Res:** F/C/L/Chaos
- **Max hit:** Phys X / kênh mỏng nhất là …
- **DPS:** X ([PoB link hoặc math chain])

### Performance Ratings

| Aspect | Rating (1-5) |
|---|---|
| clear_speed | 3 |
| boss_damage | 3 |
| survivability | 3 |
| mobility | 3 |
| league_start | 3 |
| budget_scaling | 3 |

## Gear

(Mỗi slot 1 bullet, MỞ ĐẦU bằng mod cần hunt theo thứ tự ưu tiên (kèm breakpoint số), item đang chạy chỉ là context cuối dòng. Slot unique bắt buộc → "unique bắt buộc: X — why". Ưu tiên chung: cap res → Life/ES → attribute floor → damage chính → +skill level → utility.)

- **Boots:** MS 25%+ → Life → res hở. [item hiện tại]
- …

## Budget

- Floor chạy được: ~X div — [gồm gì] · Geared: ~Y div · Món đắt nhất: [Z]

## Failure Modes

```yaml section-rules
required: true
```

(≥3 scenario gãy, mỗi cái 1 bullet `nguyên nhân → hậu quả → counter/cost`: map mod hostile · one-shot · gear floor · patch sensitivity · league start.)

## Verdict

(1-2 dòng: hợp ai, ngưỡng đầu tư, trần ở đâu.)

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
