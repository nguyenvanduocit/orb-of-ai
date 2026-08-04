// Sổ báo lỗi — cái duy nhất phải giữ đúng ở đây là: report đang mở không bao giờ
// bị dọn mất (nó là việc dev chưa làm), và spam không đẩy được report thật ra
// khỏi sổ. Test chạy trên pure core nên không đụng đĩa.

import { describe, expect, test } from "bun:test";
import bugCommand, { reportModal } from "./commands/bug";
import {
  type BugReport,
  type BugStore,
  CLOSED_RETENTION_MS,
  fileBug,
  MAX_OPEN_PER_USER,
  MAX_REPORTS,
  pruneReports,
  REPORT_COOLDOWN_MS,
  setStatus,
} from "./bugs";

const NOW = 1_800_000_000_000;

const emptyStore = (): BugStore => ({ nextId: 1, reports: [] });

const input = (reporterId = "u1", title = "lỗi gì đó") => ({
  reporterId,
  guildId: "g1",
  channelId: "c1",
  title,
  detail: "mô tả lỗi",
  steps: null,
});

// Report giả cho các test dọn rác — newest-first do người gọi tự xếp.
const fake = (id: number, over: Partial<BugReport> = {}): BugReport => ({
  id,
  reporterId: `u${id}`,
  guildId: "g1",
  channelId: "c1",
  title: `bug ${id}`,
  detail: "d",
  steps: null,
  status: "moi",
  at: NOW,
  handledBy: null,
  handledAt: null,
  ...over,
});

describe("fileBug", () => {
  test("mã tăng dần, report mới nằm đầu sổ, trạng thái mở", () => {
    const store = emptyStore();
    const first = fileBug(store, input(), NOW);
    const second = fileBug(store, input("u2"), NOW);

    expect(first.ok && first.report.id).toBe(1);
    expect(second.ok && second.report.id).toBe(2);
    expect(second.ok && second.report.status).toBe("moi");
    expect(store.reports.map((r) => r.id)).toEqual([2, 1]);
    expect(store.nextId).toBe(3);
  });

  test("cooldown chặn báo dồn, và lần bị chặn không đốt mã", () => {
    const store = emptyStore();
    fileBug(store, input(), NOW);
    const blocked = fileBug(store, input(), NOW + REPORT_COOLDOWN_MS - 1);

    expect(blocked.ok).toBe(false);
    expect(blocked.ok === false && blocked.reason).toBe("cooldown");
    expect(store.nextId).toBe(2); // sổ không đổi
    expect(store.reports).toHaveLength(1);

    // Người khác không bị dính cooldown của u1.
    expect(fileBug(store, input("u2"), NOW).ok).toBe(true);
    // Hết cooldown thì u1 báo tiếp được.
    expect(fileBug(store, input(), NOW + REPORT_COOLDOWN_MS).ok).toBe(true);
  });

  test("trần report đang mở của mỗi người, đóng bớt là báo tiếp được", () => {
    const store = emptyStore();
    for (let i = 0; i < MAX_OPEN_PER_USER; i++) {
      expect(fileBug(store, input(), NOW + i * REPORT_COOLDOWN_MS).ok).toBe(true);
    }
    const at = NOW + MAX_OPEN_PER_USER * REPORT_COOLDOWN_MS;
    const blocked = fileBug(store, input(), at);
    expect(blocked.ok === false && blocked.reason).toBe("too-many-open");

    setStatus(store, 1, "dasua", "admin", at);
    expect(fileBug(store, input(), at).ok).toBe(true);
  });
});

describe("setStatus", () => {
  test("ghi lại ai đổi và lúc nào; mã lạ trả null", () => {
    const store = emptyStore();
    fileBug(store, input(), NOW);
    const updated = setStatus(store, 1, "dasua", "admin", NOW + 5_000);

    expect(updated?.status).toBe("dasua");
    expect(updated?.handledBy).toBe("admin");
    expect(updated?.handledAt).toBe(NOW + 5_000);
    expect(setStatus(store, 999, "dasua", "admin", NOW)).toBeNull();
  });
});

describe("pruneReports (GC)", () => {
  test("report đang mở không bao giờ rụng vì cũ", () => {
    const ancient = NOW - CLOSED_RETENTION_MS * 10;
    const kept = pruneReports([fake(1, { at: ancient }), fake(2, { status: "dangxem", at: ancient })], NOW);
    expect(kept.map((r) => r.id)).toEqual([1, 2]);
  });

  test("report đã đóng rụng khi quá hạn lưu, tính từ lúc đóng", () => {
    const closedLongAgo = fake(1, { status: "dasua", at: NOW, handledAt: NOW - CLOSED_RETENTION_MS - 1 });
    const closedJustNow = fake(2, { status: "boqua", at: NOW, handledAt: NOW - 1 });
    expect(pruneReports([closedJustNow, closedLongAgo], NOW).map((r) => r.id)).toEqual([2]);
  });

  test("quá trần thì ăn report đã đóng cũ nhất trước, report đang mở sống", () => {
    // MAX_REPORTS report đang mở + 3 report đã đóng (mới đóng nên chưa quá hạn).
    const open = Array.from({ length: MAX_REPORTS }, (_, i) => fake(i + 1));
    const closed = [1, 2, 3].map((n) => fake(1000 + n, { status: "dasua", handledAt: NOW }));
    const kept = pruneReports([...open, ...closed], NOW);

    expect(kept).toHaveLength(MAX_REPORTS);
    expect(kept.every((r) => r.status === "moi")).toBe(true);
  });

  test("sổ toàn report đang mở thì cái cũ nhất rụng, cái vừa nộp luôn sống", () => {
    const store: BugStore = {
      nextId: MAX_REPORTS + 1,
      reports: Array.from({ length: MAX_REPORTS }, (_, i) => fake(MAX_REPORTS - i)),
    };
    const filed = fileBug(store, input("newcomer"), NOW + REPORT_COOLDOWN_MS);

    expect(filed.ok).toBe(true);
    expect(store.reports).toHaveLength(MAX_REPORTS);
    expect(store.reports[0]!.id).toBe(MAX_REPORTS + 1); // report mới nằm đầu
    expect(store.reports.some((r) => r.id === 1)).toBe(false); // cái cũ nhất rụng
  });
});

// Discord chỉ báo lỗi payload lúc người ta bấm nút. toJSON() chạy đúng bộ
// validator ấy ngay trong test, nên modal/lệnh dựng sai chết ở đây chứ không
// chết trong mặt người dùng.
describe("payload gửi lên Discord", () => {
  test("modal báo lỗi dựng hợp lệ, đủ ba ô", () => {
    const json = reportModal().toJSON();
    expect(json.custom_id).toBe("bug:new");
    expect(json.components).toHaveLength(3);
  });

  test("lệnh có đủ ba subcommand", () => {
    const json = bugCommand.data.toJSON();
    expect(json.name).toBe("bug");
    expect((json.options ?? []).map((opt) => opt.name)).toEqual(["baocao", "list", "xem"]);
  });
});
