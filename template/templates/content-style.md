# Content style — cheat sheet cho AI reader

Chuẩn canonical cho MỌI doc trong `content/` (người + agent đều theo). Reader chính là **AI agent** (bot trả lời Discord, write-skills, research agents) — không phải người đọc tuần tự. Tối ưu cho: scan nhanh, trích fact chính xác, đi link đúng chỗ.

## Nguyên tắc

1. **Fact-dense, zero narrative.** Mỗi dòng carry một fact/rule dùng được. Cắt: câu dẫn, câu chuyển, rhetoric, recap, mọi "voice" cho người đọc.
2. **Bullet là đơn vị mặc định.** Mỗi bullet tự đứng được (đọc một mình vẫn hiểu), một fact/rule per bullet. Prose chỉ khi quan hệ nhân-quả nhiều bước không nén được thành bullet — tối đa 2-3 câu.
3. **Fragment OK, arrow OK.** `điều kiện → hệ quả`, `A + B → C`, không cần câu hoàn chỉnh. `✗/✓` cho anti-pattern/pattern.
4. **Giữ 100% hard facts.** Nén là bỏ văn, KHÔNG bỏ fact: số liệu, mod wording nguyên văn, breakpoint, exclusion rule, thứ tự ưu tiên, giá + timestamp, trade query URL, tên node/gem/item chính xác. Mất fact = rewrite hỏng.
5. **Số luôn kèm nguồn/mốc thời gian** khi là market/meta data: `~40 div (2026-06-15, poe2scout)`. Số cơ chế game (mod roll, %) kèm patch nếu dễ đổi.
6. **Table cho data enumerable** (stat block, reservation ledger, tier list, so sánh). Bold key term lần đầu.

## Liên kết (bắt buộc, đây là giá trị chính của corpus)

- Nhắc concept có doc riêng → link inline `[Title](/route)` ngay lần đầu. Route bỏ prefix `content/` và đuôi `.md`.
- `## Relationships` cuối doc: mỗi dòng `- **predicate** [Title](/route) — reason ngắn`. Predicate snake_case: `synergizes_with | related | related_mechanics | related_builds | related_guides | requires | used_by | references | derived_from | derived_builds | source_research | competes_with | alternative_to | supports | farming_relevance | part_of | parent | follows_build`.
- Doc nào có ≥1 doc liên quan trong corpus thì Relationships KHÔNG được rỗng. Link hai chiều: A liên quan B thì cả hai doc đều khai.
- Game term (unique/skill/support/currency) → `:wiki-link{url="https://www.poe2wiki.net/wiki/<page>"}` lần đầu — vừa render site vừa cho AI canonical URL.

## Cấu trúc

- Frontmatter giữ nguyên schema template (validator đọc `sections`/`fields`). Đổi nội dung → bump `updated`.
- H1 = tên concept, KHÔNG kèm league/patch (frontmatter đã có).
- Mở đầu ngay dưới H1: **1-2 dòng** "cái này là gì + khi nào dùng". Không heading, không đoạn văn dài.
- Heading validator-enforced giữ ĐÚNG literal (`## Failure Modes`, `## Relationships`, `## Version History`). Heading tự do: ngắn, danh từ/cụm nói thẳng nội dung.
- Mỗi fact xuất hiện đúng MỘT lần ở section sở hữu nó; chỗ khác chỉ link/nhắc tên. Không section recap, không Quick Summary.
- Section rỗng/mỏng → xóa section, đừng pad.
- Changelog (nếu doc có): mỗi ngày 1-3 bullet delta, không paragraph tường thuật.

## Kích thước mục tiêu (body, không tính frontmatter)

- Guide/mechanic/item/skill đơn: ≤ 50 dòng.
- Farming strategy: ≤ 60 dòng.
- Build doc: ≤ 120 dòng.
- Vượt mục tiêu chỉ khi mật độ fact thật sự cần — không bao giờ vì văn.

## Ngôn ngữ

- Tiếng Việt telegraphic + English game term nguyên bản (more/increased, spirit, reservation, clear, uptime…). Không dịch term, không đúc từ Việt thay term.
- Không xưng hô, không register ("mình/bạn" bỏ hết — cheat sheet không có người nói).
- Exception duy nhất: `patch-notes` doc là archive verbatim bản dịch GGG — giữ nguyên văn, không nén.

## Self-test trước khi nộp

1. Xóa ngẫu nhiên một bullet — có mất fact không, hay chỉ mất văn? Mọi bullet phải là loại "mất fact".
2. AI cần trả lời "X hoạt động thế nào / giá bao nhiêu / build nào dùng" — grep trúng dòng chứa đủ answer không?
3. Mọi concept có doc riêng đã link chưa? Relationships có chiều ngược chưa?
4. Body vượt size target — dòng nào đang là văn thay vì fact?
