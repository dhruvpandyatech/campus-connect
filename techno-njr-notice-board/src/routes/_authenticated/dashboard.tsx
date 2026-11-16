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
import { NoticeCard } from "@/components/campus/NoticeCard";
import { BrandHeader, navActionClass } from "@/components/campus/BrandHeader";
import { Switch } from "@/components/ui/switch";
import { CATEGORIES, CATEGORY_IDS, isCategoryId, suggestCategory, type CategoryId } from "@/lib/categories";
import { ATTACHMENT_BUCKET, STORAGE_PREFIX, safeFileName } from "@/lib/attachments";
import { myNoticesQueryOptions, profileQueryOptions, type MyNotice } from "@/lib/faculty.queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Faculty Dashboard — Techno NJR Notice Board" },
      { name: "description", content: "Publish and manage official notices for students." },
      { property: "og:title", content: "Faculty Dashboard — Techno NJR Notice Board" },
      { property: "og:description", content: "Publish and manage official notices for students." },
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

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const firstName = profile.full_name.split(" ").filter((p) => !/^(dr|prof|mr|ms|mrs)\.?$/i.test(p))[0];

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
          <h1 className="mt-1 text-3xl font-semibold">Hello{firstName ? `, ${firstName}` : ""}</h1>
        </div>
      </section>

      <main className="mx-auto -mt-8 flex max-w-2xl flex-col gap-4 px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <ProfileCard userId={user.id} email={user.email ?? ""} fullName={profile.full_name} designation={profile.designation} />
        <PublishForm userId={user.id} />

        <section className="mt-2">
          <h2 className="mb-3 text-lg font-semibold">Your published notices</h2>
          {myNotices.length === 0 ? (
            <div className="card-surface px-5 py-8 text-center text-sm text-muted-foreground">
              Nothing published yet. Your notices will appear here and on the student feed.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {myNotices.map((n) => (
                <NoticeCard key={n.id} notice={n} actions={<DeleteNotice notice={n} userId={user.id} />} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

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
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, full_name: name.trim().slice(0, 100), designation: role.trim().slice(0, 100) });
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
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Posting as</p>
          <p className="truncate font-semibold">{fullName || email}</p>
          <p className="truncate text-sm text-muted-foreground">{designation}</p>
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
        <button type="button" onClick={() => setEditing(false)} aria-label="Cancel" className="text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pf-name">Full name</Label>
        <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Meera Iyer" className="h-11" />
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

function PublishForm({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CategoryId | "">("");
  const [manualCategory, setManualCategory] = useState(false);
  const [attachMode, setAttachMode] = useState<"file" | "link">("file");
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [pinned, setPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const suggestion = useMemo(() => suggestCategory(`${title}\n${description}`), [title, description]);

  // Auto-select the detected category until the teacher picks one themselves.
  useEffect(() => {
    if (!manualCategory && suggestion) setCategory(suggestion);
  }, [suggestion, manualCategory]);

  function reset() {
    setTitle("");
    setDescription("");
    setCategory("");
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
    if (t.length < 3) { toast.error("Add a title (at least 3 characters)."); return; }
    if (t.length > 200) { toast.error("Keep the title under 200 characters."); return; }
    if (d.length < 10) { toast.error("Add a description (at least 10 characters)."); return; }
    if (d.length > 5000) { toast.error("Keep the description under 5000 characters."); return; }
    if (!isCategoryId(category)) { toast.error("Choose a category."); return; }

    let attachmentUrl: string | null = null;
    if (attachMode === "link" && link.trim()) {
      try {
        const u = new URL(link.trim());
        if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
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

      const { error } = await supabase.from("notices").insert({
        title: t,
        content: d,
        category,
        attachment_url: attachmentUrl,
        is_pinned: pinned,
        created_by: userId,
      });
      if (error) throw error;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notices"] }),
        queryClient.invalidateQueries({ queryKey: ["my-notices", userId] }),
      ]);
      toast.success("Notice published to the student feed.");
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not publish the notice.");
    } finally {
      setSubmitting(false);
    }
  }

  const overridden = manualCategory && suggestion && category !== suggestion;

  return (
    <form onSubmit={onSubmit} className="card-surface space-y-4 p-4 sm:p-5">
      <div>
        <h2 className="text-lg font-semibold">Publish a notice</h2>
        <p className="text-sm text-muted-foreground">Goes live on the student feed instantly.</p>
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
                overridden ? "cursor-pointer ring-1 ring-ai/30 hover:ring-ai/60" : "cursor-default",
              )}
              title={overridden ? "Use the suggested category" : undefined}
            >
              ✨ AI Suggested: {CATEGORIES[suggestion].label}
              {overridden && <span className="ml-1 underline underline-offset-2">Use</span>}
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

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Attachment <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <div className="inline-flex rounded-lg bg-secondary p-0.5 text-xs font-semibold">
            {(["file", "link"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setAttachMode(m)}
                className={cn(
                  "rounded-md px-2.5 py-1 transition-colors",
                  attachMode === m ? "bg-card text-foreground shadow-card" : "text-muted-foreground",
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
              <span className="block truncate font-medium">{file ? file.name : "Choose a PDF, image or document"}</span>
              <span className="block text-xs text-muted-foreground">
                {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "Up to 20 MB"}
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
          pinned ? "border-alert/40 bg-accent" : "border-border bg-secondary/50",
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

      <Button type="submit" size="lg" className="h-12 w-full text-[15px]" disabled={submitting}>
        {submitting ? <Loader2 className="animate-spin" /> : <Send />}
        Publish notice
      </Button>
    </form>
  );
}

function DeleteNotice({ notice, userId }: { notice: MyNotice; userId: string }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    const { error } = await supabase.from("notices").delete().eq("notice_id", notice.id);
    if (!error && notice.rawAttachment?.startsWith(STORAGE_PREFIX)) {
      await supabase.storage.from(ATTACHMENT_BUCKET).remove([notice.rawAttachment.slice(STORAGE_PREFIX.length)]);
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
        <Button variant="ghost" size="icon" aria-label="Delete notice" disabled={busy} className="text-muted-foreground hover:text-destructive">
          {busy ? <Loader2 className="animate-spin" /> : <Trash2 />}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this notice?</AlertDialogTitle>
          <AlertDialogDescription>
            “{notice.title}” will be removed from the student feed. This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
