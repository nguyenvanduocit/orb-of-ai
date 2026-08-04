// Sổ báo lỗi (/bug) — nơi người chơi kể lỗi của chính con bot cho dev đọc.
//
// Global (data/global/bugs.json) chứ không per-guild: một cái lỗi là lỗi của
// BOT, không phải chuyện riêng của một phòng. Gộp chung thì ba người ở ba server
// báo trùng một lỗi vẫn thấy được của nhau (khỏi báo lại), và dev chỉ có đúng
// một chỗ để đọc. Report ghi lại guildId/channelId nơi phát hiện — đó là ngữ
// cảnh tái hiện, không phải quyền sở hữu.
//
// GC: không lifecycle event nào xoá report (người báo rời server thì cái lỗi vẫn
// còn nguyên đó), nên store TỰ DỌN mỗi lần ghi — đúng kiểu vòng history của xổ
// số: report đã đóng (đã sửa / bỏ qua) quá CLOSED_RETENTION_MS thì rụng, và tổng
// số luôn bị chặn ở MAX_REPORTS, ưu tiên rụng cái đã đóng để cái đang mở sống.
//
// Pure core (pruneReports/fileBug/setStatus) nhận store + `now` nên test được
// không cần I/O; vỏ mệnh lệnh ở cuối file làm load→mutate→save đồng bộ.

import { globalFile, readJsonFile, writeJsonFile } from "./store";

export type BugStatus = "moi" | "dangxem" | "dasua" | "boqua";

// "Mở" = còn nằm trong hàng đợi của dev. Đây là ranh giới mà GC dựa vào để
// quyết định cái nào được giữ, nên nó sống ở đây chứ không rải ở chỗ hiển thị.
export function isOpen(status: BugStatus): boolean {
  return status === "moi" || status === "dangxem";
}

export interface BugReport {
  id: number; // mã tăng dần, hiển thị là BUG-14
  reporterId: string;
  guildId: string; // nơi phát hiện — ngữ cảnh cho dev, không phải chủ sở hữu
  channelId: string;
  title: string;
  detail: string;
  steps: string | null; // bước tái hiện, không bắt buộc
  status: BugStatus;
  at: number; // epoch ms lúc báo
  handledBy: string | null; // admin đổi trạng thái gần nhất
  handledAt: number | null;
}

export interface BugStore {
  nextId: number;
  reports: BugReport[]; // newest-first
}

export const MAX_REPORTS = 200; // trần cứng — trên nữa thì cái đã đóng cũ nhất rụng
export const CLOSED_RETENTION_MS = 30 * 24 * 60 * 60_000; // đã sửa/bỏ qua giữ 30 ngày
export const REPORT_COOLDOWN_MS = 60_000; // chống spam: mỗi người 1 report / phút
export const MAX_OPEN_PER_USER = 5; // và tối đa 5 report đang mở cùng lúc
export const TITLE_MAX = 100;
export const DETAIL_MAX = 1000;
export const STEPS_MAX = 500;

export function loadBugs(): BugStore {
  const raw = readJsonFile<Partial<BugStore>>(globalFile("bugs.json"));
  return { nextId: raw?.nextId ?? 1, reports: raw?.reports ?? [] };
}

export function saveBugs(store: BugStore): void {
  writeJsonFile(globalFile("bugs.json"), store);
}

// Pure. Dọn theo hai tầng: (1) report đã đóng quá hạn lưu thì bỏ — lỗi đã sửa
// xong hết giá trị tra cứu; (2) vẫn quá trần thì rụng tiếp từ cũ nhất, nhưng ăn
// cái ĐÃ ĐÓNG trước, vì cái đang mở mới là việc chưa làm.
export function pruneReports(reports: BugReport[], now: number): BugReport[] {
  const kept = reports.filter(
    (report) => isOpen(report.status) || now - (report.handledAt ?? report.at) < CLOSED_RETENTION_MS,
  );
  if (kept.length <= MAX_REPORTS) return kept;

  const overflow = kept.length - MAX_REPORTS;
  const doomed = new Set<number>();
  for (let i = kept.length - 1; i >= 0 && doomed.size < overflow; i--) {
    if (!isOpen(kept[i]!.status)) doomed.add(kept[i]!.id);
  }
  for (let i = kept.length - 1; i >= 0 && doomed.size < overflow; i--) doomed.add(kept[i]!.id);
  return kept.filter((report) => !doomed.has(report.id));
}

export interface BugInput {
  reporterId: string;
  guildId: string;
  channelId: string;
  title: string;
  detail: string;
  steps: string | null;
}

export type FileBugResult =
  | { ok: true; report: BugReport }
  | { ok: false; reason: "cooldown"; retryAt: number }
  | { ok: false; reason: "too-many-open"; open: number };

// Pure core: ghi một report vào store (mutate tại chỗ) rồi dọn rác ngay trong
// cùng lượt ghi. Hai chốt chặn spam đứng TRƯỚC mọi thay đổi, nên một lần bị từ
// chối không đốt id và không đụng gì tới sổ.
export function fileBug(store: BugStore, input: BugInput, now: number): FileBugResult {
  const mine = store.reports.filter((report) => report.reporterId === input.reporterId);
  const lastAt = mine.reduce((newest, report) => Math.max(newest, report.at), 0);
  if (now - lastAt < REPORT_COOLDOWN_MS) {
    return { ok: false, reason: "cooldown", retryAt: lastAt + REPORT_COOLDOWN_MS };
  }
  const open = mine.filter((report) => isOpen(report.status)).length;
  if (open >= MAX_OPEN_PER_USER) return { ok: false, reason: "too-many-open", open };

  const report: BugReport = {
    id: store.nextId,
    reporterId: input.reporterId,
    guildId: input.guildId,
    channelId: input.channelId,
    title: input.title.slice(0, TITLE_MAX),
    detail: input.detail.slice(0, DETAIL_MAX),
    steps: input.steps ? input.steps.slice(0, STEPS_MAX) : null,
    status: "moi",
    at: now,
    handledBy: null,
    handledAt: null,
  };
  store.nextId += 1;
  store.reports = pruneReports([report, ...store.reports], now);
  return { ok: true, report };
}

// Pure core: đổi trạng thái một report. Trả null khi mã không còn (đã bị GC dọn
// hoặc gõ sai). Dọn luôn ở đây vì đóng một report chính là lúc nó bắt đầu đếm
// ngược hạn lưu.
export function setStatus(
  store: BugStore,
  id: number,
  status: BugStatus,
  adminId: string,
  now: number,
): BugReport | null {
  const report = store.reports.find((entry) => entry.id === id);
  if (!report) return null;
  report.status = status;
  report.handledBy = adminId;
  report.handledAt = now;
  store.reports = pruneReports(store.reports, now);
  return report;
}

// --- Vỏ mệnh lệnh: load→mutate→save đồng bộ, không await xen giữa ---

export function reportBug(input: BugInput): FileBugResult {
  const store = loadBugs();
  const result = fileBug(store, input, Date.now());
  if (result.ok) saveBugs(store);
  return result;
}

export function updateBugStatus(id: number, status: BugStatus, adminId: string): BugReport | null {
  const store = loadBugs();
  const report = setStatus(store, id, status, adminId, Date.now());
  if (report) saveBugs(store);
  return report;
}

export function findBug(id: number): BugReport | null {
  return loadBugs().reports.find((report) => report.id === id) ?? null;
}

export type BugFilter = "mo" | "dasua" | "boqua" | "tatca";

export function listBugs(filter: BugFilter): BugReport[] {
  const { reports } = loadBugs();
  if (filter === "tatca") return reports;
  if (filter === "mo") return reports.filter((report) => isOpen(report.status));
  return reports.filter((report) => report.status === filter);
}

// Đếm theo trạng thái cho dòng tổng kết của /bug list — một lần đọc sổ.
export function bugCounts(): Record<BugStatus, number> {
  const counts: Record<BugStatus, number> = { moi: 0, dangxem: 0, dasua: 0, boqua: 0 };
  for (const report of loadBugs().reports) counts[report.status] += 1;
  return counts;
}
