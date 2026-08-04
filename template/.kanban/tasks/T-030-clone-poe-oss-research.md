# T-030: Clone POE OSS projects để nghiên cứu kỹ thuật

> Shallow-clone một bộ dự án POE open-source thú vị về `data/github-research/` để đào sâu kiến trúc/kỹ thuật từng cái.

- **priority**: low
- **effort**: M

## Problem

Hệ sinh thái tool POE trên GitHub có nhiều dự án giải bài toán kỹ thuật thật (reverse-engineer RNG/format file, datamining pipeline, port calc engine sang WASM, log-parsing telemetry, market arbitrage graph). Một số trùng đúng thứ workspace đang tự reimplement trong skill (`poe2scout`, `poe2.re`, PoB calc). Đọc source gốc giúp học pattern + xem có gì mượn được, nhưng đang nằm rải rác trên web — cần kéo về local để đào.

## Goal

Có một thư mục local chứa source của các dự án POE đáng học, kèm index map mỗi repo → góc kỹ thuật của nó, để các session sau đào sâu từng cái mà không phải tìm lại.

## Requirements

- Clone vào `data/github-research/`, `--depth 1` (chỉ cần code hiện tại, không cần history).
- Thư mục gitignored — đây là reference clone, không phải source-of-truth của site (theo convention `data/pob-source/`).
- Bỏ qua PoB (đã có ở `data/pob-source/`) và skilltree-export (đã pin ở `data/passive-tree/`).
- Viết `data/github-research/README.md` (KHÔNG gitignored phần index) hoặc note index ngoài thư mục gitignored: mỗi repo một dòng — ngôn ngữ + góc kỹ thuật + tại sao đáng đào.
- Non-goal: chưa cần đọc/phân tích sâu từng repo trong task này — đó là việc của các session đào sâu tiếp theo.

## Criteria

- [ ] 16 repo curated clone xong vào `data/github-research/` (hoặc log rõ repo nào FAIL + lý do).
- [ ] `data/github-research/` đã thêm vào `.gitignore` (clone không lọt vào git).
- [ ] Có index doc liệt kê từng repo → ngôn ngữ + góc kỹ thuật + lý do đào.
- [ ] `git status` không thấy hàng nghìn file clone bị stage.
