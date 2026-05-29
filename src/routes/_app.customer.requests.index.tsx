import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { StatusBadge } from "@/components/StatusBadge";
import type { RequestStatus } from "@/lib/types";
import { format } from "date-fns";
import {
  ArrowRight,
  Clock,
  Filter,
  Inbox,
  Layers,
  MapPin,
  PlusCircle,
  Search,
  Tag,
  FileText,
  CalendarClock,
} from "lucide-react";

export const Route = createFileRoute("/_app/customer/requests/")({
  component: List,
});

type Row = {
  id: string;
  title: string;
  description: string | null;
  city: string | null;
  status: RequestStatus;
  created_at: string;
  category: {
    name_ar: string;
    name_en: string;
    name_tr: string | null;
  } | null;
};

const FILTERS = ["all", "active", "completed", "cancelled"] as const;
type Filter = (typeof FILTERS)[number];
type SortKey = "newest" | "oldest";

const SORT_OPTIONS: { key: SortKey; en: string; ar: string }[] = [
  { key: "newest", en: "NEWEST", ar: "الأحدث" },
  { key: "oldest", en: "OLDEST", ar: "الأقدم" },
];

function List() {
  const { t, lang } = useI18n();
  const isRtl = lang === "ar";
  const fmt = useMemo(
    () =>
      new Intl.NumberFormat(
        lang === "ar" ? "ar-EG" : lang === "tr" ? "tr-TR" : "en-US",
      ),
    [lang],
  );

  useEffect(() => {
    document.title = t("meta_my_requests_title");
  }, [t]);

  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [query, setQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["my-requests"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data } = await supabase
        .from("service_requests")
        .select(
          "id, title, description, city, status, created_at, category:service_categories(name_ar, name_en, name_tr)",
        )
        .eq("customer_id", user!.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as Row[];
    },
  });

  const rows = data ?? [];

  const categoryName = (c: Row["category"]) => {
    if (!c) return "";
    return (
      (lang === "en" ? c.name_en : lang === "tr" ? c.name_tr : c.name_ar) ||
      c.name_ar ||
      c.name_en ||
      ""
    );
  };

  const counts = useMemo(() => {
    const active = rows.filter(
      (r) => !["completed", "cancelled"].includes(r.status),
    ).length;
    return {
      all: rows.length,
      active,
      completed: rows.filter((r) => r.status === "completed").length,
      cancelled: rows.filter((r) => r.status === "cancelled").length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const passFilter = (r: Row) =>
      filter === "all"
        ? true
        : filter === "active"
          ? !["completed", "cancelled"].includes(r.status)
          : r.status === filter;
    const passQuery = (r: Row) =>
      !q ||
      r.title.toLowerCase().includes(q) ||
      (r.city ?? "").toLowerCase().includes(q);
    const arr = rows.filter((r) => passFilter(r) && passQuery(r));
    arr.sort((a, b) => {
      const A = new Date(a.created_at).getTime();
      const B = new Date(b.created_at).getTime();
      return sort === "newest" ? B - A : A - B;
    });
    return arr;
  }, [rows, filter, sort, query]);

  const latest = rows[0];

  const filterLabel = (f: Filter) =>
    isRtl
      ? f === "all"
        ? "الكل"
        : f === "active"
          ? "نشط"
          : f === "completed"
            ? "مكتمل"
            : "ملغي"
      : f === "all"
        ? "ALL"
        : f === "active"
          ? "ACTIVE"
          : f === "completed"
            ? "DONE"
            : "CANCELLED";

  return (
    <div className="space-y-6 -m-4 md:-m-6 lg:-m-8 p-4 md:p-6 lg:p-8 bg-background min-h-[calc(100vh-4rem)]">
      {/* === MASTHEAD === */}
      <header className="grid grid-cols-12 gap-4 items-end pb-2 border-b-2 border-foreground">
        <div className="col-span-12 lg:col-span-8">
          <h1 className="font-display text-[clamp(2.5rem,6vw,4.75rem)] leading-[0.9] tracking-tight text-foreground">
            <span className="block italic font-light">{t("my_requests")}</span>
            <span className="block">
              {fmt.format(counts.all)}
              <span className="text-primary">.</span>
            </span>
          </h1>
          <p className="mt-4 max-w-xl text-sm text-muted-foreground leading-relaxed">
            {lang === "en"
              ? "Every request you've filed — open, archived, or in motion."
              : lang === "tr"
                ? "Açtığınız tüm talepler — açık, arşivlenmiş veya devam eden."
                : "كل طلب أرسلتَه — مفتوح، مؤرشف، أو قيد التنفيذ."}{" "}
            <span className="font-mono-ui text-foreground/70">
              // {fmt.format(filtered.length)}{" "}
              {isRtl ? "نتيجة بعد التصفية." : "after filters."}
            </span>
          </p>
        </div>
        <div className="col-span-12 lg:col-span-4 grid grid-cols-2 gap-2 lg:justify-end">
          <KeyBox
            icon={FileText}
            label={isRtl ? "نشط" : "ACTIVE"}
            value={fmt.format(counts.active)}
          />
          <KeyBox
            icon={CalendarClock}
            label={isRtl ? "الأخير" : "LATEST"}
            value={latest ? format(new Date(latest.created_at), "dd LLL") : "—"}
            mono
          />
        </div>
      </header>

      {/* === COMMAND BAR === */}
      <div className="border border-foreground bg-card flex flex-wrap items-stretch divide-x divide-foreground rtl:divide-x-reverse">
        <div className="flex items-center gap-3 px-4 py-3 min-w-0">
          <Filter className="h-3.5 w-3.5 text-foreground/70" />
          <span className="label-mono text-foreground">SORT</span>
        </div>
        <div className="flex flex-wrap divide-x divide-foreground/30 rtl:divide-x-reverse">
          {SORT_OPTIONS.map((opt) => {
            const active = sort === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSort(opt.key)}
                className={`px-4 py-3 font-mono-ui text-[11px] tracking-[0.18em] uppercase transition-colors ${
                  active
                    ? "bg-foreground text-primary font-semibold"
                    : "text-foreground/80 hover:bg-muted"
                }`}
              >
                {isRtl ? opt.ar : opt.en}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 px-4 py-3 flex-1 min-w-[240px]">
          <Search className="h-3.5 w-3.5 text-foreground/60 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              lang === "en"
                ? "Search title or city…"
                : lang === "tr"
                  ? "Başlık veya şehir ara…"
                  : "ابحث بالعنوان أو المدينة…"
            }
            className="w-full bg-transparent outline-none font-mono-ui text-[11px] tracking-[0.06em] uppercase placeholder:text-foreground/40"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="label-mono text-foreground/50 hover:text-foreground"
            >
              ×
            </button>
          )}
        </div>
        <Link
          to="/customer/requests/new"
          className="px-4 py-3 font-mono-ui text-[11px] tracking-[0.18em] uppercase flex items-center gap-2 bg-foreground text-primary hover:bg-primary hover:text-foreground transition-colors"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          {t("new_request")}
        </Link>
      </div>

      {/* === GRID: STATUS SIDEBAR + RESULTS === */}
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* STATUS SIDEBAR */}
        <aside className="border border-foreground bg-card self-start">
          <div className="flex items-baseline justify-between px-4 pt-3 pb-2 border-b border-foreground/15">
            <div className="flex items-center gap-2">
              <Layers className="h-3 w-3 text-foreground/70" />
              <h2 className="label-mono text-foreground tracking-[0.24em]">
                {isRtl ? "الحالة" : "STATUS"}
              </h2>
            </div>
            {(filter !== "all" || sort !== "newest" || query) && (
              <button
                type="button"
                onClick={() => {
                  setFilter("all");
                  setSort("newest");
                  setQuery("");
                }}
                className="font-mono-ui text-[10px] uppercase tracking-[0.22em] text-foreground/70 hover:text-primary"
              >
                {t("reset_filters")}
              </button>
            )}
          </div>
          <ul className="divide-y divide-border">
            {FILTERS.map((f) => {
              const active = filter === f;
              const count = counts[f];
              return (
                <li key={f}>
                  <button
                    type="button"
                    onClick={() => setFilter(f)}
                    className={`w-full text-start flex items-center justify-between gap-2 px-4 py-3 transition-colors ${
                      active
                        ? "bg-foreground text-primary"
                        : "hover:bg-muted text-foreground/85"
                    } ${count === 0 && f !== "all" ? "opacity-50" : ""}`}
                  >
                    <span className="font-display text-base leading-none">
                      {filterLabel(f)}
                    </span>
                    <span className="font-mono-ui text-[10px] tabular-nums">
                      {fmt.format(count)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* RESULTS */}
        <section className="space-y-4 min-w-0">
          <div className="flex items-baseline justify-between px-1">
            <p className="label-mono text-foreground/70">
              {isRtl ? "نتائج" : "RESULTS"} · {fmt.format(filtered.length)}
            </p>
            {filter !== "all" && (
              <p className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {filterLabel(filter)}
              </p>
            )}
          </div>

          {isLoading ? (
            <ResultsSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyTickets
              isRtl={isRtl}
              hasQuery={query.length > 0 || filter !== "all"}
            />
          ) : (
            <ol className="grid gap-3 md:grid-cols-2">
              {filtered.map((r, i) => (
                <li key={r.id}>
                  <Link
                    to="/customer/requests/$id"
                    params={{ id: r.id }}
                    className="group/card relative flex flex-col gap-3 border border-foreground bg-card p-4 hover:brutal-shadow-sm hover:-translate-x-[2px] hover:-translate-y-[2px] transition-all h-full"
                  >
                    {/* Ticket header strip */}
                    <div className="flex items-center justify-between -mx-4 -mt-4 px-4 py-2 border-b border-foreground/20 bg-muted/30 font-mono-ui text-[10px] uppercase tracking-[0.22em]">
                      <span className="tabular-nums text-foreground/70">
                        №{String(i + 1).padStart(3, "0")} ·{" "}
                        {r.id.slice(0, 6).toUpperCase()}
                      </span>
                      <StatusBadge status={r.status} />
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 border border-foreground bg-foreground text-primary flex items-center justify-center shrink-0">
                        <Tag className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        {r.category && (
                          <div className="label-mono text-foreground/70 truncate">
                            {categoryName(r.category)}
                          </div>
                        )}
                        <h3 className="font-display text-xl leading-tight mt-0.5 truncate">
                          {r.title}
                        </h3>
                      </div>
                    </div>

                    {r.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                        {r.description}
                      </p>
                    )}

                    {/* Filed hero */}
                    <div className="flex items-end justify-between border-y border-foreground/15 py-2 my-1">
                      <div>
                        <div className="label-mono text-muted-foreground">
                          {isRtl ? "مُسجَّل" : "FILED"}
                        </div>
                        <div className="font-display font-light text-3xl leading-none tabular-nums mt-1">
                          {format(new Date(r.created_at), "dd")}
                          <span className="text-sm font-mono-ui ms-1 tracking-[0.18em] text-muted-foreground">
                            {format(new Date(r.created_at), "LLL yyyy").toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="text-end">
                        <div className="label-mono text-muted-foreground">
                          {isRtl ? "رقم" : "REF"}
                        </div>
                        <div className="font-display font-light text-3xl leading-none tabular-nums mt-1">
                          #{String(i + 1).padStart(3, "0")}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      {r.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {r.city}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(r.created_at), "MM/dd HH:mm")}
                      </span>
                    </div>

                    <div className="mt-auto pt-3 border-t border-foreground/20 flex items-center justify-between">
                      <span className="label-mono text-foreground group-hover/card:text-primary transition-colors">
                        {t("view_details")}
                      </span>
                      <span className="h-7 w-7 border border-foreground bg-foreground text-primary flex items-center justify-center group-hover/card:bg-primary group-hover/card:text-foreground transition-colors">
                        <ArrowRight
                          className={`h-3.5 w-3.5 ${isRtl ? "rotate-180" : ""}`}
                        />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

/* ---------- subcomponents ---------- */

function KeyBox({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="border border-foreground bg-card px-3 py-2 flex items-center gap-3 min-w-0">
      <div className="h-8 w-8 bg-foreground text-background flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="label-mono text-muted-foreground truncate">{label}</div>
        <div
          className={`${mono ? "font-mono-display text-sm" : "font-display text-lg"} leading-none tabular-nums truncate`}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="border border-foreground/40 bg-card h-56" />
      ))}
    </div>
  );
}

function EmptyTickets({
  isRtl,
  hasQuery,
}: {
  isRtl: boolean;
  hasQuery: boolean;
}) {
  const { t, lang } = useI18n();
  return (
    <div className="border-2 border-dashed border-foreground/30 bg-card p-12 flex flex-col items-center text-center gap-3">
      <div className="h-14 w-14 border border-foreground bg-background flex items-center justify-center">
        <Inbox className="h-6 w-6 text-foreground/60" />
      </div>
      <h3 className="font-display text-2xl leading-tight">
        {hasQuery
          ? lang === "en"
            ? "No filings match."
            : lang === "tr"
              ? "Eşleşen kayıt yok."
              : "لا توجد طلبات مطابقة."
          : lang === "en"
            ? "The page is blank."
            : lang === "tr"
              ? "Sayfa boş."
              : "الصفحة فارغة."}
      </h3>
      <p className="font-mono-ui text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {hasQuery
          ? t("no_data")
          : isRtl
            ? "— لم تُسجَّل طلبات بعد —"
            : "— no filings on record —"}
      </p>
      {!hasQuery && (
        <Link to="/customer/requests/new" className="mt-2">
          <span className="btn-stamp !w-auto !px-5 !py-2.5">
            <PlusCircle className="h-3.5 w-3.5 me-2" />
            {t("new_request")}
          </span>
        </Link>
      )}
    </div>
  );
}
