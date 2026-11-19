import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  FileUp,
  Link2,
  Loader2,
  LogOut,
  Pencil,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { NoticeCard } from "@/components/campus/NoticeCard";
import { BrandHeader, navActionClass } from "@/components/campus/BrandHeader";
import { Switch } from "@/components/ui/switch";
import {
  CATEGORIES,
  CATEGORY_IDS,
  isCategoryId,
  suggestCategory,
  type CategoryId,
} from "@/lib/categories";
import {
  TARGET_AUDIENCES,
  AUDIENCE_CONFIG,
  isTargetAudience,
  type TargetAudience,
} from "@/lib/target-audience";
import {
  ATTACHMENT_BUCKET,
  STORAGE_PREFIX,
  safeFileName,
} from "@/lib/attachments";
import {
  myNoticesQueryOptions,
  profileQueryOptions,
  type MyNotice,
} from "@/lib/faculty.queries";
import { updateNotice } from "@/lib/notices.functions";
import { cn } from "@/lib/utils";
import type { TablesInsert } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Faculty Dashboard — Techno NJR Notice Board" },
      {
        name: "description",
        content: "Publish and manage official notices for students.",
      },
      {
        property: "og:title",
        content: "Faculty Dashboard — Techno NJR Notice Board",
      },
      {
        property: "og:description",
        content: "Publish and manage official notices for students.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context }) => {
    const userId = context.user.id;
    await Promise.all([
      context.queryClient.ensureQueryData(profileQueryOptions(userId)),
      context.queryClient.ensureQueryData(myNoticesQueryOptions(userId)),
    ]);
  },
  component: Dashboard,
});

function Dashboard() {
  const { user, queryClient } = Route.useRouteContext();
  const navigate = useNavigate();
  const { data: profile } = useSuspenseQuery(profileQueryOptions(user.id));
  const { data: myNotices } = useSuspenseQuery(myNoticesQueryOptions(user.id));

  // If a student navigates to the dashboard, redirect them to the student feed
  useEffect(() => {
    if (
      profile.role === "student" ||
      (profile.student_year !== null && profile.student_year !== undefined)
    ) {
      navigate({ to: "/", replace: true });
    }
  }, [profile, navigate]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const firstName = profile.full_name
    .split(" ")
    .filter((p) => !/^(dr|prof|mr|ms|mrs)\.?$/i.test(p))[0];

  return (
    <div className="min-h-screen bg-background">
      <BrandHeader
        action={
          <button type="button" onClick={signOut} className={navActionClass}>
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        }
      />
      <section className="masthead-bg text-masthead-foreground">
        <div className="mx-auto max-w-2xl px-4 pb-14 pt-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-masthead-muted hover:text-masthead-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Notice board
          </Link>
          <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-masthead-muted">
            Faculty dashboard
          </p>
          <h1 className="mt-1 text-3xl font-semibold">
            Hello{firstName ? `, ${firstName}` : ""}
          </h1>
        </div>
      </section>

      <main className="mx-auto -mt-8 flex max-w-2xl flex-col gap-4 px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <ProfileCard
          userId={user.id}
          email={user.email ?? ""}
          fullName={profile.full_name}
          designation={profile.designation}
        />
        <PublishForm userId={user.id} />

        <section className="mt-2">
          <h2 className="mb-3 text-lg font-semibold">Your published notices</h2>
          {myNotices.length === 0 ? (
            <div className="card-surface px-5 py-8 text-center text-sm text-muted-foreground">
              Nothing published yet. Your notices will appear here and on the
              student feed.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {myNotices.map((n) => (
                <NoticeCard
                  key={n.id}
                  notice={n}
                  actions={
                    <div className="flex items-center gap-1">
                      <EditNotice notice={n} userId={user.id} />
                      <DeleteNotice notice={n} userId={user.id} />
                    </div>
                  }
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

// ─── Profile Card ─────────────────────────────────────────────────────────────

function ProfileCard({
  userId,
  email,
  fullName,
  designation,
}: {
  userId: string;
  email: string;
  fullName: string;
  designation: string;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(fullName);
  const [role, setRole] = useState(designation);
  const [saving, setSaving] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !role.trim()) {
      toast.error("Name and designation are required.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      full_name: name.trim().slice(0, 100),
      designation: role.trim().slice(0, 100),
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    toast.success("Profile updated. New notices will show these details.");
    setEditing(false);
  }

  if (!editing) {
    return (
      <section className="card-surface flex items-center gap-3 p-4 shadow-lift">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Posting as
          </p>
          <p className="truncate font-semibold">{fullName || email}</p>
          <p className="truncate text-sm text-muted-foreground">
            {designation}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil /> Edit
        </Button>
      </section>
    );
  }

  return (
    <form onSubmit={save} className="card-surface space-y-3 p-4 shadow-lift">
      <div className="flex items-center justify-between">
        <p className="font-semibold">Your details on notices</p>
        <button
          type="button"
          onClick={() => setEditing(false)}
          aria-label="Cancel"
          className="text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pf-name">Full name</Label>
        <Input
          id="pf-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Dr. Meera Iyer"
          className="h-11"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pf-role">Designation</Label>
        <Input
          id="pf-role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="HOD, Computer Engineering"
          className="h-11"
        />
      </div>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving && <Loader2 className="animate-spin" />} Save details
      </Button>
    </form>
  );
}

// ─── Publish Form ─────────────────────────────────────────────────────────────

function PublishForm({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CategoryId | "">("");
  const [audience, setAudience] = useState<TargetAudience>("all");
  const [manualCategory, setManualCategory] = useState(false);
  const [attachMode, setAttachMode] = useState<"file" | "link">("file");
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [pinned, setPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const suggestion = useMemo(
    () => suggestCategory(`${title}\n${description}`),
    [title, description],
  );

  // Auto-select the detected category until the teacher picks one themselves.
  useEffect(() => {
    if (!manualCategory && suggestion) setCategory(suggestion);
  }, [suggestion, manualCategory]);

  function reset() {
    setTitle("");
    setDescription("");
    setCategory("");
    setAudience("all");
    setManualCategory(false);
    setFile(null);
    setLink("");
    setPinned(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    const d = description.trim();
    if (t.length < 3) {
      toast.error("Add a title (at least 3 characters).");
      return;
    }
    if (t.length > 200) {
      toast.error("Keep the title under 200 characters.");
      return;
    }
    if (d.length < 10) {
      toast.error("Add a description (at least 10 characters).");
      return;
    }
    if (d.length > 5000) {
      toast.error("Keep the description under 5000 characters.");
      return;
    }
    if (!isCategoryId(category)) {
      toast.error("Choose a category.");
      return;
    }

    let attachmentUrl: string | null = null;
    if (attachMode === "link" && link.trim()) {
      try {
        const u = new URL(link.trim());
        if (u.protocol !== "https:" && u.protocol !== "http:")
          throw new Error();
        attachmentUrl = u.toString();
      } catch {
        toast.error("Enter a valid link starting with https://");
        return;
      }
    }
    if (attachMode === "file" && file && file.size > 20 * 1024 * 1024) {
      toast.error("Attachments must be 20 MB or smaller.");
      return;
    }

    setSubmitting(true);
    try {
      if (attachMode === "file" && file) {
        const path = `${userId}/${Date.now()}-${safeFileName(file.name)}`;
        const { error: upErr } = await supabase.storage
          .from(ATTACHMENT_BUCKET)
          .upload(path, file, { contentType: file.type || undefined });
        if (upErr) throw upErr;
        attachmentUrl = STORAGE_PREFIX + path;
      }

      const insertPayload: TablesInsert<"notices"> = {
        title: t,
        content: d,
        category,
        target_audience: audience,
        attachment_url: attachmentUrl,
        is_pinned: pinned,
        created_by: userId,
      };

      let { error } = await supabase.from("notices").insert(insertPayload);
      if (
        error &&
        (error.message.includes("target_audience") ||
          error.message.includes("does not exist"))
      ) {
        delete insertPayload["target_audience"];
        const fallbackRes = await supabase
          .from("notices")
          .insert(insertPayload);
        error = fallbackRes.error;
      }
      if (error) throw error;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notices"] }),
        queryClient.invalidateQueries({ queryKey: ["my-notices", userId] }),
      ]);
      toast.success("Notice published to the student feed.");
      reset();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not publish the notice.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const overridden = manualCategory && suggestion && category !== suggestion;

  return (
    <form onSubmit={onSubmit} className="card-surface space-y-4 p-4 sm:p-5">
      <div>
        <h2 className="text-lg font-semibold">Publish a notice</h2>
        <p className="text-sm text-muted-foreground">
          Goes live on the student feed instantly.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="n-title">Title</Label>
        <Input
          id="n-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="e.g. Mid-semester exam schedule released"
          className="h-11"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="n-desc">Description</Label>
        <Textarea
          id="n-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={5000}
          rows={5}
          placeholder="Write the full announcement…"
          className="text-[15px]"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="n-cat">Category</Label>
          {suggestion && (
            <button
              type="button"
              disabled={!overridden}
              onClick={() => {
                setCategory(suggestion);
                setManualCategory(false);
              }}
              className={cn(
                "fade-up inline-flex items-center gap-1 rounded-full bg-ai-soft px-2.5 py-1 text-xs font-semibold text-ai",
                overridden
                  ? "cursor-pointer ring-1 ring-ai/30 hover:ring-ai/60"
                  : "cursor-default",
              )}
              title={overridden ? "Use the suggested category" : undefined}
            >
              ✨ AI Suggested: {CATEGORIES[suggestion].label}
              {overridden && (
                <span className="ml-1 underline underline-offset-2">Use</span>
              )}
            </button>
          )}
        </div>
        <Select
          value={category}
          onValueChange={(v) => {
            if (isCategoryId(v)) {
              setCategory(v);
              setManualCategory(true);
            }
          }}
        >
          <SelectTrigger id="n-cat" className="h-11">
            <SelectValue placeholder="Choose a category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_IDS.map((id) => (
              <SelectItem key={id} value={id}>
                {CATEGORIES[id].emoji} {CATEGORIES[id].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!suggestion && !category && (
          <p className="text-xs text-muted-foreground">
            Start typing — we'll suggest a category from your text.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="n-audience">Target Audience</Label>
          <span className="text-xs text-muted-foreground">
            {AUDIENCE_CONFIG[audience].description}
          </span>
        </div>
        <Select
          value={audience}
          onValueChange={(v) => {
            if (isTargetAudience(v)) setAudience(v);
          }}
        >
          <SelectTrigger id="n-audience" className="h-11">
            <SelectValue placeholder="Choose target audience" />
          </SelectTrigger>
          <SelectContent>
            {TARGET_AUDIENCES.map((id) => (
              <SelectItem key={id} value={id}>
                {AUDIENCE_CONFIG[id].emoji} {AUDIENCE_CONFIG[id].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>
            Attachment{" "}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </Label>
          <div className="inline-flex rounded-lg bg-secondary p-0.5 text-xs font-semibold">
            {(["file", "link"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setAttachMode(m)}
                className={cn(
                  "rounded-md px-2.5 py-1 transition-colors",
                  attachMode === m
                    ? "bg-card text-foreground shadow-card"
                    : "text-muted-foreground",
                )}
              >
                {m === "file" ? "Upload file" : "Paste link"}
              </button>
            ))}
          </div>
        </div>

        {attachMode === "file" ? (
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-input bg-secondary/50 px-3 py-3 text-sm transition-colors hover:bg-secondary">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-card text-primary">
              <FileUp className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {file ? file.name : "Choose a PDF, image or document"}
              </span>
              <span className="block text-xs text-muted-foreground">
                {file
                  ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
                  : "Up to 20 MB"}
              </span>
            </span>
            {file && (
              <button
                type="button"
                aria-label="Remove file"
                onClick={(e) => {
                  e.preventDefault();
                  setFile(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              className="sr-only"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.txt,.csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        ) : (
          <div className="relative">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="url"
              inputMode="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://drive.google.com/…"
              className="h-11 pl-9"
            />
          </div>
        )}
      </div>

      <label
        htmlFor="n-pinned"
        className={cn(
          "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 transition-colors",
          pinned
            ? "border-alert/40 bg-accent"
            : "border-border bg-secondary/50",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Mark as important</span>
          <span className="block text-xs text-muted-foreground">
            Pins it to the top of the feed with a red banner.
          </span>
        </span>
        <Switch id="n-pinned" checked={pinned} onCheckedChange={setPinned} />
      </label>

      <Button
        type="submit"
        size="lg"
        className="h-12 w-full text-[15px]"
        disabled={submitting}
      >
        {submitting ? <Loader2 className="animate-spin" /> : <Send />}
        Publish notice
      </Button>
    </form>
  );
}

// ─── Edit Notice ──────────────────────────────────────────────────────────────

function EditNotice({ notice, userId }: { notice: MyNotice; userId: string }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  // Form state — initialised from the existing notice when dialog opens
  const [title, setTitle] = useState(notice.title);
  const [description, setDescription] = useState(notice.content);
  const [category, setCategory] = useState<CategoryId | "">(notice.category);
  const [audience, setAudience] = useState<TargetAudience>(
    notice.targetAudience ?? "all",
  );
  const [manualCategory, setManualCategory] = useState(true);
  const [attachMode, setAttachMode] = useState<"keep" | "file" | "link">(
    "keep",
  );
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState(
    notice.rawAttachment && !notice.rawAttachment.startsWith(STORAGE_PREFIX)
      ? notice.rawAttachment
      : "",
  );
  const [clearAttachment, setClearAttachment] = useState(false);
  const [pinned, setPinned] = useState(notice.pinned ?? false);
  const [saving, setSaving] = useState(false);

  const suggestion = useMemo(
    () => suggestCategory(`${title}\n${description}`),
    [title, description],
  );

  // Reset form state each time the dialog opens so it reflects latest notice data
  useEffect(() => {
    if (open) {
      setTitle(notice.title);
      setDescription(notice.content);
      setCategory(notice.category);
      setAudience(notice.targetAudience ?? "all");
      setManualCategory(true);
      setAttachMode("keep");
      setFile(null);
      setLink(
        notice.rawAttachment && !notice.rawAttachment.startsWith(STORAGE_PREFIX)
          ? notice.rawAttachment
          : "",
      );
      setClearAttachment(false);
      setPinned(notice.pinned ?? false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [open, notice]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    const d = description.trim();
    if (t.length < 3) {
      toast.error("Title must be at least 3 characters.");
      return;
    }
    if (t.length > 200) {
      toast.error("Keep the title under 200 characters.");
      return;
    }
    if (d.length < 10) {
      toast.error("Description must be at least 10 characters.");
      return;
    }
    if (d.length > 5000) {
      toast.error("Keep the description under 5000 characters.");
      return;
    }
    if (!isCategoryId(category)) {
      toast.error("Choose a category.");
      return;
    }
    if (attachMode === "file" && file && file.size > 20 * 1024 * 1024) {
      toast.error("Attachments must be 20 MB or smaller.");
      return;
    }

    // Determine new attachment URL
    let attachmentUrl: string | null = notice.rawAttachment ?? null;
    if (clearAttachment) {
      attachmentUrl = null;
    } else if (attachMode === "link" && link.trim()) {
      try {
        const u = new URL(link.trim());
        if (u.protocol !== "https:" && u.protocol !== "http:")
          throw new Error();
        attachmentUrl = u.toString();
      } catch {
        toast.error("Enter a valid link starting with https://");
        return;
      }
    } else if (attachMode === "file" && file) {
      const path = `${userId}/${Date.now()}-${safeFileName(file.name)}`;
      const { error: upErr } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .upload(path, file, { contentType: file.type || undefined });
      if (upErr) {
        toast.error(upErr.message);
        return;
      }
      attachmentUrl = STORAGE_PREFIX + path;
    }

    setSaving(true);
    try {
      await updateNotice({
        data: {
          noticeId: notice.id,
          userId,
          title: t,
          content: d,
          category,
          targetAudience: audience,
          attachmentUrl,
          isPinned: pinned,
        },
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notices"] }),
        queryClient.invalidateQueries({ queryKey: ["my-notices", userId] }),
      ]);
      toast.success("Notice updated successfully.");
      setOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not update the notice.",
      );
    } finally {
      setSaving(false);
    }
  }

  const overridden = manualCategory && suggestion && category !== suggestion;
  const hasExistingAttachment = !!notice.rawAttachment && !clearAttachment;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Edit notice"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-primary"
      >
        <Pencil className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit notice</DialogTitle>
            <DialogDescription>
              Update the details below and save. Changes go live immediately.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSave} className="space-y-4 pt-1">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="e-title">Title</Label>
              <Input
                id="e-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder="e.g. Mid-semester exam schedule released"
                className="h-11"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="e-desc">Description</Label>
              <Textarea
                id="e-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={5000}
                rows={5}
                placeholder="Write the full announcement…"
                className="text-[15px]"
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="e-cat">Category</Label>
                {suggestion && (
                  <button
                    type="button"
                    disabled={!overridden}
                    onClick={() => {
                      setCategory(suggestion);
                      setManualCategory(false);
                    }}
                    className={cn(
                      "fade-up inline-flex items-center gap-1 rounded-full bg-ai-soft px-2.5 py-1 text-xs font-semibold text-ai",
                      overridden
                        ? "cursor-pointer ring-1 ring-ai/30 hover:ring-ai/60"
                        : "cursor-default",
                    )}
                    title={
                      overridden ? "Use the suggested category" : undefined
                    }
                  >
                    ✨ AI Suggested: {CATEGORIES[suggestion].label}
                    {overridden && (
                      <span className="ml-1 underline underline-offset-2">
                        Use
                      </span>
                    )}
                  </button>
                )}
              </div>
              <Select
                value={category}
                onValueChange={(v) => {
                  if (isCategoryId(v)) {
                    setCategory(v);
                    setManualCategory(true);
                  }
                }}
              >
                <SelectTrigger id="e-cat" className="h-11">
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_IDS.map((id) => (
                    <SelectItem key={id} value={id}>
                      {CATEGORIES[id].emoji} {CATEGORIES[id].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Target Audience */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="e-audience">Target Audience</Label>
                <span className="text-xs text-muted-foreground">
                  {AUDIENCE_CONFIG[audience].description}
                </span>
              </div>
              <Select
                value={audience}
                onValueChange={(v) => {
                  if (isTargetAudience(v)) setAudience(v);
                }}
              >
                <SelectTrigger id="e-audience" className="h-11">
                  <SelectValue placeholder="Choose target audience" />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_AUDIENCES.map((id) => (
                    <SelectItem key={id} value={id}>
                      {AUDIENCE_CONFIG[id].emoji} {AUDIENCE_CONFIG[id].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Attachment */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  Attachment{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <div className="inline-flex rounded-lg bg-secondary p-0.5 text-xs font-semibold">
                  {(["keep", "file", "link"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setAttachMode(m);
                        if (m !== "keep") setClearAttachment(false);
                      }}
                      className={cn(
                        "rounded-md px-2.5 py-1 transition-colors",
                        attachMode === m
                          ? "bg-card text-foreground shadow-card"
                          : "text-muted-foreground",
                      )}
                    >
                      {m === "keep" ? "Keep" : m === "file" ? "Upload" : "Link"}
                    </button>
                  ))}
                </div>
              </div>

              {attachMode === "keep" && (
                <div className="rounded-lg border border-border bg-secondary/50 px-3 py-3 text-sm">
                  {hasExistingAttachment ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-muted-foreground">
                        {notice.attachmentLabel ?? "Current attachment"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setClearAttachment(true)}
                        className="shrink-0 text-xs font-semibold text-destructive hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ) : clearAttachment ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">
                        Attachment will be removed.
                      </span>
                      <button
                        type="button"
                        onClick={() => setClearAttachment(false)}
                        className="shrink-0 text-xs font-semibold text-primary hover:underline"
                      >
                        Undo
                      </button>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">
                      No current attachment.
                    </span>
                  )}
                </div>
              )}

              {attachMode === "file" && (
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-input bg-secondary/50 px-3 py-3 text-sm transition-colors hover:bg-secondary">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-card text-primary">
                    <FileUp className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {file ? file.name : "Choose a PDF, image or document"}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {file
                        ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
                        : "Up to 20 MB"}
                    </span>
                  </span>
                  {file && (
                    <button
                      type="button"
                      aria-label="Remove file"
                      onClick={(e) => {
                        e.preventDefault();
                        setFile(null);
                        if (fileRef.current) fileRef.current.value = "";
                      }}
                      className="text-muted-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    className="sr-only"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.txt,.csv"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              )}

              {attachMode === "link" && (
                <div className="relative">
                  <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="url"
                    inputMode="url"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://drive.google.com/…"
                    className="h-11 pl-9"
                  />
                </div>
              )}
            </div>

            {/* Pinned toggle */}
            <label
              htmlFor="e-pinned"
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 transition-colors",
                pinned
                  ? "border-alert/40 bg-accent"
                  : "border-border bg-secondary/50",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">
                  Mark as important
                </span>
                <span className="block text-xs text-muted-foreground">
                  Pins it to the top of the feed with a red banner.
                </span>
              </span>
              <Switch
                id="e-pinned"
                checked={pinned}
                onCheckedChange={setPinned}
              />
            </label>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                Save changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Delete Notice ────────────────────────────────────────────────────────────

function DeleteNotice({
  notice,
  userId,
}: {
  notice: MyNotice;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    const { error } = await supabase
      .from("notices")
      .delete()
      .eq("notice_id", notice.id);
    if (!error && notice.rawAttachment?.startsWith(STORAGE_PREFIX)) {
      await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .remove([notice.rawAttachment.slice(STORAGE_PREFIX.length)]);
    }
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["notices"] }),
      queryClient.invalidateQueries({ queryKey: ["my-notices", userId] }),
    ]);
    toast.success("Notice removed.");
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete notice"
          disabled={busy}
          className="text-muted-foreground hover:text-destructive"
        >
          {busy ? <Loader2 className="animate-spin" /> : <Trash2 />}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this notice?</AlertDialogTitle>
          <AlertDialogDescription>
            "{notice.title}" will be removed from the student feed. This can't
            be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={remove}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
