import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import * as LucideIcons from "lucide-react";
import {
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Tag,
  Upload,
  X,
  ArrowRight,
  ArrowLeft,
  FileText,
  Layers,
  ListChecks,
  Camera,
  Sparkles,
} from "lucide-react";

type LucideIcon = LucideIcons.LucideIcon;
const ICON_MAP = LucideIcons as unknown as Record<string, LucideIcon>;
const kebabToPascal = (s: string) =>
  s.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("");
function resolveIcon(name: string | null | undefined): LucideIcon {
  if (!name) return Tag;
  return (ICON_MAP[name] as LucideIcon) ?? (ICON_MAP[kebabToPascal(name)] as LucideIcon) ?? Tag;
}

type Category = {
  id: string;
  name_ar: string;
  name_en: string;
  name_tr: string | null;
  description_ar: string | null;
  description_en: string | null;
  description_tr: string | null;
  icon: string | null;
};

type GeoState =
  | { status: "idle" }
  | { status: "detecting" }
  | { status: "detected"; lat: number; lng: number }
  | { status: "denied" }
  | { status: "unavailable" }
  | { status: "unsupported" };

export const Route = createFileRoute("/_app/customer/requests/new")({
  component: NewReq,
});

function NewReq() {
  const { t, lang, dir } = useI18n() as {
    t: (k: string) => string;
    lang: string;
    dir?: "ltr" | "rtl";
  };
  const isRtl = dir === "rtl" || lang === "ar";
  const Arrow = isRtl ? ArrowLeft : ArrowRight;
  const nav = useNavigate();
  const fmt = useMemo(
    () =>
      new Intl.NumberFormat(
        lang === "ar" ? "ar-EG" : lang === "tr" ? "tr-TR" : "en-US",
      ),
    [lang],
  );

  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [geo, setGeo] = useState<GeoState>({ status: "idle" });

  useEffect(() => {
    document.title = t("meta_new_request_title");
  }, [t]);

  const schema = z.object({
    category_id: z.string().uuid(t("select_service_required")),
    title: z.string().min(3, t("title_required")).max(120),
    description: z.string().min(20, t("description_min")).max(2000),
    address: z.string().min(5, t("address_required")).max(300),
    city: z.string().max(80).optional(),
  });
  type FormVals = z.infer<typeof schema>;

  const { data: categories, isLoading: catsLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () =>
      ((await supabase.from("service_categories").select("*").eq("is_active", true)).data ?? []) as Category[],
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", description: "", address: "", city: "" },
  });
  const catId = watch("category_id");
  const titleVal = watch("title") ?? "";
  const descVal = watch("description") ?? "";
  const addressVal = watch("address") ?? "";
  const cityVal = watch("city") ?? "";

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeo({ status: "unsupported" });
      toast.error(t("location_unsupported"));
      return;
    }
    setGeo({ status: "detecting" });
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGeo({ status: "detected", lat: pos.coords.latitude, lng: pos.coords.longitude });
        toast.success(t("location_detected"));
      },
      err => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeo({ status: "denied" });
          toast.error(t("location_denied"));
        } else {
          setGeo({ status: "unavailable" });
          toast.error(t("location_unavailable"));
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, [t]);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  const displayName = (c: Category) =>
    (lang === "en" ? c.name_en : lang === "tr" ? c.name_tr : c.name_ar) || c.name_ar || c.name_en;
  const displayDesc = (c: Category) =>
    (lang === "en" ? c.description_en : lang === "tr" ? c.description_tr : c.description_ar) ?? "";

  const selectedCat = useMemo(
    () => (categories ?? []).find(c => c.id === catId),
    [categories, catId],
  );

  const completion = useMemo(() => {
    let n = 0;
    if (catId) n += 1;
    if (titleVal.trim().length >= 3) n += 1;
    if (descVal.trim().length >= 20) n += 1;
    if (addressVal.trim().length >= 5) n += 1;
    if (geo.status === "detected") n += 1;
    return n;
  }, [catId, titleVal, descVal, addressVal, geo]);
  const readyToFile = completion === 5;

  const onSubmit = async (values: FormVals) => {
    if (geo.status !== "detected") {
      toast.error(t("location_required_to_submit"));
      requestLocation();
      return;
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const { data: req, error } = await supabase
      .from("service_requests")
      .insert({
        customer_id: user.id,
        ...values,
        lat: geo.lat,
        lng: geo.lng,
        status: "pending",
      })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    if (images.length && req) {
      await supabase.from("request_images").insert(
        images.map(url => ({
          request_id: req.id,
          uploaded_by: user.id,
          url,
          type: "issue_photo" as const,
        })),
      );
    }
    toast.success(t("request_created"));
    nav({ to: `/customer/requests/${req!.id}` });
  };

  const bearingsLabel =
    geo.status === "detected"
      ? `${geo.lat.toFixed(3)}, ${geo.lng.toFixed(3)}`
      : geo.status === "detecting"
        ? isRtl ? "جاري…" : "FIXING…"
        : isRtl ? "—" : "OFF";

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6 -m-4 md:-m-6 lg:-m-8 p-4 md:p-6 lg:p-8 bg-background min-h-[calc(100vh-4rem)]"
    >
      {/* === MASTHEAD === */}
      <header className="grid grid-cols-12 gap-4 items-end pb-2 border-b-2 border-foreground">
        <div className="col-span-12 lg:col-span-8">
          <h1 className="font-display text-[clamp(2.5rem,6vw,4.75rem)] leading-[0.9] tracking-tight text-foreground">
            <span className="block italic font-light">{t("new_request")}</span>
            <span className="block">
              {fmt.format(completion)}<span className="text-primary">/</span>{fmt.format(5)}
              <span className="text-primary">.</span>
            </span>
          </h1>
          <p className="mt-4 max-w-xl text-sm text-muted-foreground leading-relaxed">
            {lang === "en"
              ? "File a new matter. The bureau routes your request to the nearest qualified hand."
              : lang === "tr"
                ? "Yeni bir talep oluştur. Talebiniz en yakın uzman ele yönlendirilecek."
                : "سجّل طلبًا جديدًا. سيُوجَّه طلبك إلى أقرب يدٍ مؤهلة."}{" "}
            <span className="font-mono-ui text-foreground/70">
              // {readyToFile
                ? isRtl ? "جاهز للإرسال." : "ready to file."
                : isRtl ? `${fmt.format(5 - completion)} متبقّي.` : `${fmt.format(5 - completion)} left.`}
            </span>
          </p>
        </div>
        <div className="col-span-12 lg:col-span-4 grid grid-cols-2 gap-2 lg:justify-end">
          <KeyBox
            icon={ListChecks}
            label={isRtl ? "اكتمال" : "PROGRESS"}
            value={`${fmt.format(completion)}/${fmt.format(5)}`}
            mono
          />
          <KeyBox
            icon={MapPin}
            label={isRtl ? "الموقع" : "BEARINGS"}
            value={bearingsLabel}
            mono
          />
        </div>
      </header>

      {/* === COMMAND BAR === */}
      <div className="border border-foreground bg-card flex flex-wrap items-stretch divide-x divide-foreground rtl:divide-x-reverse">
        <div className="flex items-center gap-3 px-4 py-3 min-w-0">
          <Sparkles className="h-3.5 w-3.5 text-foreground/70" />
          <span className="label-mono text-foreground">
            {isRtl ? "إيداع" : "INTAKE"}
          </span>
        </div>
        <div className="flex items-center px-4 py-3 flex-1 min-w-[200px] font-mono-ui text-[10px] uppercase tracking-[0.22em] text-foreground/70">
          {isRtl ? "املأ الحقول الخمسة لإرسال الطلب" : "Complete all five fields to file"}
        </div>
        <Link
          to="/customer/requests"
          className="px-4 py-3 font-mono-ui text-[11px] tracking-[0.18em] uppercase flex items-center gap-2 text-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className={`h-3.5 w-3.5 ${isRtl ? "rotate-180" : ""}`} />
          {t("cancel")}
        </Link>
      </div>

      {/* === GRID: FORM + DOCKET === */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* MAIN: form sections */}
        <div className="space-y-6 min-w-0">
          {/* I — THE TRADE */}
          <FormPanel
            num="01"
            label={isRtl ? "الخدمة" : "TRADE"}
            title={t("select_service")}
            icon={Layers}
            ok={!!catId}
          >
            {catsLoading ? (
              <div className="grid gap-3 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="border border-foreground/40 bg-card h-32 animate-pulse" />
                ))}
              </div>
            ) : (
              <div
                role="radiogroup"
                aria-label={t("select_service")}
                className="grid gap-3 md:grid-cols-2"
              >
                {(categories ?? []).map((c, idx) => {
                  const Icon = resolveIcon(c.icon);
                  const selected = catId === c.id;
                  const name = displayName(c);
                  const desc = displayDesc(c);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setValue("category_id", c.id, { shouldValidate: true })}
                      className={cn(
                        "group/card relative flex flex-col gap-3 border border-foreground bg-card p-4 text-start h-full transition-all",
                        "hover:brutal-shadow-sm hover:-translate-x-[2px] hover:-translate-y-[2px]",
                        selected && "bg-foreground text-primary",
                      )}
                    >
                      <div
                        className={cn(
                          "flex items-center justify-between -mx-4 -mt-4 px-4 py-2 border-b font-mono-ui text-[10px] uppercase tracking-[0.22em]",
                          selected
                            ? "border-primary/30 bg-foreground/80"
                            : "border-foreground/20 bg-muted/30",
                        )}
                      >
                        <span className={cn("tabular-nums", selected ? "text-primary/80" : "text-foreground/70")}>
                          № {String(idx + 1).padStart(3, "0")}
                        </span>
                        {selected && (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            {isRtl ? "محدد" : "PICKED"}
                          </span>
                        )}
                      </div>

                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "h-12 w-12 border flex items-center justify-center shrink-0",
                            selected
                              ? "border-primary bg-primary text-foreground"
                              : "border-foreground bg-foreground text-primary",
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div
                            className={cn(
                              "label-mono truncate",
                              selected ? "text-primary/80" : "text-foreground/70",
                            )}
                          >
                            № {String(idx + 1).padStart(2, "0")}
                          </div>
                          <h3 className="font-display text-xl leading-tight mt-0.5 truncate">
                            {name}
                          </h3>
                        </div>
                      </div>

                      {desc && (
                        <p
                          className={cn(
                            "text-sm leading-relaxed line-clamp-2",
                            selected ? "text-primary/80" : "text-muted-foreground",
                          )}
                        >
                          {desc}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            {errors.category_id && (
              <ErrorLine msg={errors.category_id.message ?? ""} />
            )}
          </FormPanel>

          {/* II — PARTICULARS */}
          <FormPanel
            num="02"
            label={isRtl ? "التفاصيل" : "PARTICULARS"}
            title={isRtl ? "اشرح طلبك" : "State your case"}
            icon={FileText}
            ok={titleVal.trim().length >= 3 && descVal.trim().length >= 20}
          >
            <div className="space-y-5">
              <FieldRow
                label={t("title")}
                count={`${titleVal.length}/120`}
              >
                <input
                  {...register("title")}
                  placeholder={t("request_title_placeholder")}
                  className={cn("input-edit", errors.title && "!border-destructive")}
                />
                {errors.title && <ErrorLine msg={errors.title.message ?? ""} />}
              </FieldRow>

              <FieldRow
                label={t("description")}
                count={`${descVal.length}/2000`}
              >
                <textarea
                  {...register("description")}
                  rows={5}
                  placeholder={t("request_description_placeholder")}
                  className={cn(
                    "w-full border border-foreground bg-card p-3 font-serif text-base leading-relaxed text-foreground outline-none resize-y min-h-[8rem] focus:brutal-shadow-sm transition-shadow",
                    errors.description && "border-destructive",
                  )}
                />
                {errors.description && (
                  <ErrorLine msg={errors.description.message ?? ""} />
                )}
              </FieldRow>
            </div>
          </FormPanel>

          {/* III — WHEREABOUTS */}
          <FormPanel
            num="03"
            label={isRtl ? "الموقع" : "WHEREABOUTS"}
            title={isRtl ? "أين نأتي إليك" : "Where to call"}
            icon={MapPin}
            ok={addressVal.trim().length >= 5 && geo.status === "detected"}
          >
            <div className="grid md:grid-cols-2 gap-5">
              <FieldRow label={t("address")}>
                <input
                  {...register("address")}
                  placeholder={isRtl ? "العنوان التفصيلي" : "Street, building, apt..."}
                  className={cn("input-edit", errors.address && "!border-destructive")}
                />
                {errors.address && <ErrorLine msg={errors.address.message ?? ""} />}
              </FieldRow>
              <FieldRow label={t("city")}>
                <input
                  {...register("city")}
                  placeholder={isRtl ? "المدينة" : "City, district..."}
                  className="input-edit"
                />
              </FieldRow>
            </div>

            <div className="mt-5 border border-foreground bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "h-8 w-8 border border-foreground flex items-center justify-center shrink-0",
                    geo.status === "detected"
                      ? "bg-foreground text-primary"
                      : "bg-card text-foreground",
                  )}
                >
                  {geo.status === "detecting" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : geo.status === "detected" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="label-mono text-foreground/70">
                    {geo.status === "detected"
                      ? (isRtl ? "تم تحديد الموقع" : "LOCATION FIXED")
                      : geo.status === "detecting"
                        ? (isRtl ? "جاري التحديد" : "FIXING BEARINGS")
                        : (isRtl ? "الموقع مطلوب" : "BEARINGS REQUIRED")}
                  </div>
                  <div className="mt-1 font-mono-ui text-[12px] text-foreground tabular-nums">
                    {geo.status === "detected" ? (
                      <>
                        {t("current_location")}: {geo.lat.toFixed(5)}, {geo.lng.toFixed(5)}
                      </>
                    ) : geo.status === "detecting" ? (
                      <>{t("detecting_location")}…</>
                    ) : (
                      <span className="text-muted-foreground">
                        {geo.status === "denied"
                          ? t("location_denied")
                          : geo.status === "unavailable"
                            ? t("location_unavailable")
                            : geo.status === "unsupported"
                              ? t("location_unsupported")
                              : t("location_required_desc")}
                      </span>
                    )}
                  </div>
                  {geo.status !== "detected" &&
                    geo.status !== "detecting" &&
                    geo.status !== "unsupported" && (
                      <button
                        type="button"
                        onClick={requestLocation}
                        className="mt-3 px-3 py-2 border border-foreground bg-card hover:bg-foreground hover:text-primary transition-colors font-mono-ui text-[10px] tracking-[0.22em] uppercase flex items-center gap-2"
                      >
                        <MapPin className="h-3 w-3" />
                        {geo.status === "denied" || geo.status === "unavailable"
                          ? t("retry_location")
                          : t("enable_location")}
                      </button>
                    )}
                </div>
              </div>
            </div>
          </FormPanel>

          {/* IV — EVIDENCE */}
          <FormPanel
            num="04"
            label={isRtl ? "الصور" : "EVIDENCE"}
            title={isRtl ? "أرفق صورًا" : "Attach photos"}
            icon={Camera}
            ok={images.length > 0}
            optional
          >
            <BrutalUploader value={images} onChange={setImages} isRtl={isRtl} />
          </FormPanel>
        </div>

        {/* SIDEBAR: docket */}
        <aside className="lg:sticky lg:top-6 self-start space-y-3">
          <div className="border border-foreground bg-card">
            <div className="flex items-baseline justify-between px-4 pt-3 pb-2 border-b border-foreground/15">
              <div className="flex items-center gap-2">
                <ListChecks className="h-3 w-3 text-foreground/70" />
                <h2 className="label-mono text-foreground tracking-[0.24em]">
                  {isRtl ? "الملخّص" : "DOCKET"}
                </h2>
              </div>
              <span className="font-mono-ui text-[10px] tabular-nums text-foreground/70">
                {fmt.format(completion)}/{fmt.format(5)}
              </span>
            </div>

            {/* meter */}
            <div className="px-4 py-3 border-b border-foreground/15">
              <div className="grid grid-cols-5 gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-2 border border-foreground",
                      i < completion ? "bg-primary border-primary" : "bg-background",
                    )}
                  />
                ))}
              </div>
            </div>

            <ul className="divide-y divide-border">
              <DocketRow
                label={isRtl ? "الخدمة" : "TRADE"}
                value={selectedCat ? displayName(selectedCat) : "—"}
                ok={!!selectedCat}
              />
              <DocketRow
                label={isRtl ? "العنوان" : "TITLE"}
                value={titleVal.trim() || "—"}
                ok={titleVal.trim().length >= 3}
              />
              <DocketRow
                label={isRtl ? "الوصف" : "DETAIL"}
                value={
                  descVal.trim()
                    ? `${descVal.trim().slice(0, 48)}${descVal.length > 48 ? "…" : ""}`
                    : "—"
                }
                ok={descVal.trim().length >= 20}
              />
              <DocketRow
                label={isRtl ? "المكان" : "WHERE"}
                value={[addressVal, cityVal].filter(Boolean).join(" · ") || "—"}
                ok={addressVal.trim().length >= 5}
              />
              <DocketRow
                label={isRtl ? "الموقع" : "BEARINGS"}
                value={
                  geo.status === "detected"
                    ? `${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)}`
                    : geo.status === "detecting"
                      ? (isRtl ? "جاري…" : "Fixing…")
                      : (isRtl ? "—" : "Not given")
                }
                ok={geo.status === "detected"}
              />
              <DocketRow
                label={isRtl ? "الصور" : "PHOTOS"}
                value={
                  images.length === 0
                    ? (isRtl ? "—" : "None")
                    : `${fmt.format(images.length)}`
                }
                ok={images.length > 0}
                optional
              />
            </ul>
          </div>

          <button
            type="submit"
            disabled={loading || !readyToFile}
            className="btn-stamp"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {isRtl ? "جاري الإرسال…" : "FILING…"}
              </span>
            ) : !readyToFile ? (
              <span className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" />
                {isRtl
                  ? `أكمل ${fmt.format(5 - completion)} حقول`
                  : `COMPLETE ${fmt.format(completion)}/${fmt.format(5)}`}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                {t("submit")}
                <Arrow className="h-4 w-4" />
              </span>
            )}
          </button>

          <Link
            to="/customer/requests"
            className="block text-center w-full px-4 py-3 border border-foreground bg-card hover:bg-muted transition-colors font-mono-ui text-[11px] tracking-[0.22em] uppercase text-foreground"
          >
            {t("cancel")}
          </Link>

          <p className="font-mono-ui text-[10px] uppercase tracking-[0.22em] text-muted-foreground leading-relaxed pt-2 border-t border-foreground/15">
            {isRtl
              ? "// جميع الطلبات خاصة. يراها فقط المختصّ المُعتمَد."
              : "// All filings are private. Only the tradespeople who accept your matter will see the details."}
          </p>
        </aside>
      </div>
    </form>
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

function FormPanel({
  num,
  label,
  title,
  icon: Icon,
  ok,
  optional,
  children,
}: {
  num: string;
  label: string;
  title: string;
  icon: typeof FileText;
  ok: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-foreground bg-card">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-foreground/20 bg-muted/30">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono-ui text-[10px] tracking-[0.28em] uppercase font-semibold bg-foreground text-primary px-2 py-1 tabular-nums">
            № {num}
          </span>
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="h-3.5 w-3.5 text-foreground/70 shrink-0" />
            <span className="label-mono text-foreground/70 truncate">{label}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {optional && (
            <span className="font-mono-ui text-[9px] tracking-[0.22em] uppercase text-muted-foreground">
              opt
            </span>
          )}
          <span
            className={cn(
              "h-5 w-5 border border-foreground flex items-center justify-center",
              ok ? "bg-foreground text-primary" : "bg-background text-foreground/30",
            )}
          >
            {ok ? <CheckCircle2 className="h-3 w-3" /> : <span className="h-1.5 w-1.5 bg-current" />}
          </span>
        </div>
      </div>
      <div className="p-4 md:p-5">
        <h3 className="font-display text-2xl md:text-3xl leading-tight mb-4">
          {title}
          <span className="text-primary">.</span>
        </h3>
        {children}
      </div>
    </section>
  );
}

function FieldRow({
  label,
  count,
  children,
}: {
  label: string;
  count?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span className="label-mono text-foreground/70">{label}</span>
        {count && (
          <span className="font-mono-ui text-[10px] tabular-nums text-muted-foreground">
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function ErrorLine({ msg }: { msg: string }) {
  return (
    <p className="mt-2 font-mono-ui text-[10px] uppercase tracking-[0.18em] text-destructive flex items-center gap-1.5">
      <AlertTriangle className="h-3 w-3" />
      {msg}
    </p>
  );
}

function DocketRow({
  label,
  value,
  ok,
  optional,
}: {
  label: string;
  value: string;
  ok: boolean;
  optional?: boolean;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span className="label-mono text-muted-foreground w-16 shrink-0 pt-0.5">
        {label}
      </span>
      <span
        className={cn(
          "flex-1 text-sm leading-snug break-words min-w-0",
          ok ? "text-foreground" : "text-muted-foreground italic",
        )}
      >
        {value}
      </span>
      <span
        className={cn(
          "shrink-0 mt-1.5 h-2 w-2 rounded-full",
          ok
            ? "bg-primary"
            : optional
              ? "bg-foreground/20"
              : "bg-foreground/30",
        )}
      />
    </li>
  );
}

function BrutalUploader({
  value,
  onChange,
  max = 5,
  bucket = "request-images",
  isRtl,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  bucket?: string;
  isRtl: boolean;
}) {
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    if (value.length + files.length > max) {
      toast.error(`MAX ${max}`);
      return;
    }
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("not authenticated");
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} > 5MB`);
          continue;
        }
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from(bucket).upload(path, file);
        if (error) {
          toast.error(error.message);
          continue;
        }
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
        uploaded.push(pub.publicUrl);
      }
      onChange([...value, ...uploaded]);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between font-mono-ui text-[10px] uppercase tracking-[0.22em]">
        <span className="text-foreground/70">
          {value.length} / {max} {isRtl ? "مرفق" : "ATTACHED"}
        </span>
        <span className="text-muted-foreground normal-case tracking-normal">
          jpg · png · webp · 5MB
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {value.map((u, i) => (
          <div
            key={u}
            className="relative aspect-square border border-foreground bg-card overflow-hidden"
          >
            <img src={u} alt="" className="w-full h-full object-cover" />
            <span className="absolute top-1.5 inset-inline-start-1.5 font-mono-ui text-[9px] bg-foreground text-primary px-1.5 py-0.5 tracking-[0.18em] tabular-nums">
              № {String(i + 1).padStart(2, "0")}
            </span>
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="absolute top-1.5 inset-inline-end-1.5 h-6 w-6 bg-foreground text-primary flex items-center justify-center hover:bg-primary hover:text-foreground transition-colors"
              aria-label="remove"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {value.length < max && (
          <label className="relative aspect-square border border-dashed border-foreground/50 bg-background hover:bg-muted hover:border-foreground transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer">
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-foreground/70" />
            ) : (
              <Upload className="h-5 w-5 text-foreground/70" />
            )}
            <span className="font-mono-ui text-[10px] tracking-[0.22em] uppercase text-foreground/70">
              {uploading
                ? (isRtl ? "تحميل…" : "UPLOADING")
                : (isRtl ? "إرفاق" : "ATTACH")}
            </span>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={e => handleFiles(e.target.files)}
            />
          </label>
        )}
      </div>
    </div>
  );
}
