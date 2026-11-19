import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  parseISO,
} from "date-fns";
import {
  ArrowRight,
  Bell,
  BellOff,
  Bookmark,
  BookmarkCheck,
  Calendar,
  Check,
  Clock,
  Link2,
  Loader2,
  LogOut,
  Mail,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { BrandHeader } from "@/components/campus/BrandHeader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import {
  listCalendarEvents,
  CalendarEvent,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getGoogleConnection,
  getEventSyncMappings,
  processSyncQueueFn,
  toggleEventSync,
  disconnectGoogleFn,
  listBookmarks,
  createBookmark,
  deleteBookmark,
  listReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  getReminderOffsetOptions,
  calculateRemindAt,
  type EventSyncMapping,
  type CalendarBookmark,
  type PersonalReminder,
} from "@/lib/calendar.functions";

type View = "month" | "week" | "day" | "bookmarks" | "reminders";

function SyncStatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    pending: "bg-warning/10 text-warning border border-warning/20",
    synced: "bg-success/10 text-success border border-success/20",
    failed: "bg-destructive/10 text-destructive border border-destructive/20",
    deleted: "bg-muted/10 text-muted-foreground border border-muted/20",
  };
  const labels: Record<string, string> = {
    pending: "Sync pending",
    synced: "Synced",
    failed: "Sync failed",
    deleted: "Cancelled",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium border ${variants[status] || "bg-muted/10 text-muted-foreground border border-muted/20"}`}
    >
      {labels[status] || status}
    </span>
  );
}

export const Route = createFileRoute("/calendar")({
  component: CalendarPage,
});

function CalendarPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [view, setView] = useState<View>("month");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["calendar-events"],
    queryFn: () => listCalendarEvents(),
  });

  const { data: bookmarks = [], isLoading: bookmarksLoading } = useQuery({
    queryKey: ["calendar-bookmarks"],
    queryFn: () => listBookmarks(),
  });

  const bookmarkedEventIds = new Set(
    bookmarks.map((b) => b.eventId).filter(Boolean) as string[],
  );

  const { data: reminders = [], isLoading: remindersLoading } = useQuery({
    queryKey: ["calendar-reminders"],
    queryFn: () => listReminders(),
  });

  const remindersByEventId = new Map(
    reminders
      .filter((r) => r.eventId)
      .map((r) => [r.eventId!, r] as [string, (typeof reminders)[0]]),
  );

  const { data: connection, isLoading: connectionLoading } = useQuery({
    queryKey: ["google-connection"],
    queryFn: () => getGoogleConnection(),
  });

  const { data: mappings = [], isLoading: mappingsLoading } = useQuery({
    queryKey: ["event-sync-mappings"],
    queryFn: () => getEventSyncMappings(),
  });

  const mappingByEventId = new Map(mappings.map((m) => [m.eventId, m]));

  const disconnectMutation = useMutation({
    mutationFn: () => disconnectGoogleFn(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-connection"] });
      toast.success("Disconnected from Google Calendar");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Disconnect failed");
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => processSyncQueueFn(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-sync-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["google-connection"] });
      toast.success("Sync completed");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Sync failed");
    },
  });

  const toggleSyncMutation = useMutation({
    mutationFn: ({ eventId, enabled }: { eventId: string; enabled: boolean }) =>
      toggleEventSync({ data: { eventId, enabled } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-sync-mappings"] });
      toast.success("Sync preference updated");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update sync preference");
    },
  });

  const createBookmarkMutation = useMutation({
    mutationFn: (eventId: string) => createBookmark({ data: { eventId } }),
    onSuccess: (result, eventId) => {
      if (!result.alreadyExists) {
        queryClient.invalidateQueries({ queryKey: ["calendar-bookmarks"] });
        toast.success("Bookmark added");
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to add bookmark");
    },
  });

  const deleteBookmarkMutation = useMutation({
    mutationFn: (eventId: string) => deleteBookmark({ data: { eventId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-bookmarks"] });
      toast.success("Bookmark removed");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to remove bookmark");
    },
  });

  const createReminderMutation = useMutation({
    mutationFn: (data: {
      title: string;
      notes: string | null;
      remindAt: string;
      eventId: string | null;
      channel: "in_app" | "email";
    }) => createReminder({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-reminders"] });
      toast.success("Reminder created");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to create reminder");
    },
  });

  const updateReminderMutation = useMutation({
    mutationFn: (data: {
      reminderId: string;
      title?: string;
      notes?: string | null;
      remindAt?: string;
      channel?: "in_app" | "email";
      status?: "pending" | "sent" | "cancelled";
    }) => updateReminder({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-reminders"] });
      toast.success("Reminder updated");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update reminder");
    },
  });

  const deleteReminderMutation = useMutation({
    mutationFn: (reminderId: string) =>
      deleteReminder({ data: { reminderId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-reminders"] });
      toast.success("Reminder deleted");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete reminder");
    },
  });

  const toggleBookmark = (eventId: string) => {
    if (bookmarkedEventIds.has(eventId)) {
      deleteBookmarkMutation.mutate(eventId);
    } else {
      createBookmarkMutation.mutate(eventId);
    }
  };

  const isBookmarked = (eventId: string) => bookmarkedEventIds.has(eventId);

  const getSyncStatus = (eventId: string): string => {
    const m = mappingByEventId.get(eventId);
    return m ? m.syncStatus : "not_synced";
  };

  const isEventSynced = (eventId: string): boolean => {
    const m = mappingByEventId.get(eventId);
    return m ? m.syncStatus === "synced" : false;
  };

  const handleToggleSync = (eventId: string, enabled: boolean) => {
    toggleSyncMutation.mutate({ eventId, enabled });
  };

  const handleSyncNow = () => {
    syncMutation.mutate();
  };

  const handleDisconnect = () => {
    disconnectMutation.mutate();
  };

  const filteredEvents =
    view === "bookmarks"
      ? events.filter((e) => bookmarkedEventIds.has(e.id))
      : view === "reminders"
        ? events.filter((e) => remindersByEventId.has(e.id))
        : events;

  const now = new Date();
  const days = eachDayOfInterval({
    start: startOfMonth(now),
    end: endOfMonth(now),
  });

  return (
    <div className="min-h-screen bg-background">
      <BrandHeader />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Academic Calendar</h1>
            <p className="text-sm text-muted-foreground">
              Official college events and Google Calendar sync
            </p>
          </div>
          <div className="flex gap-2">
            {(["month", "week", "day", "bookmarks", "reminders"] as const).map(
              (v) => (
                <Button
                  key={v}
                  variant={view === v ? "default" : "outline"}
                  size="sm"
                  onClick={() => setView(v)}
                >
                  {v === "bookmarks" ? (
                    <>
                      <Bookmark className="h-3.5 w-3.5 mr-1" /> Bookmarks
                    </>
                  ) : v === "reminders" ? (
                    <>
                      <Bell className="h-3.5 w-3.5 mr-1" /> Reminders
                    </>
                  ) : (
                    v
                  )}
                </Button>
              ),
            )}
          </div>
        </div>

        {/* Google Calendar Connection Section */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between py-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4" /> Google Calendar
              </CardTitle>
              <CardDescription>
                Synchronize official events to your Google Calendar.
              </CardDescription>
            </div>
            {connectionLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : connection?.connected ? (
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-success">
                  Connected: {connection.email}
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDisconnect}
                >
                  <X className="h-3 w-3" /> Disconnect
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  navigateToGoogleConnect();
                }}
              >
                <ArrowRight className="h-3 w-3" /> Connect Google Calendar
              </Button>
            )}
          </CardHeader>
          {connection?.connected && (
            <CardContent className="py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Last synced:{connection.lastSyncedAt ? " " : " never"}
                    {connection.lastSyncedAt ? (
                      <span className="text-xs font-medium">
                        {new Date(connection.lastSyncedAt).toLocaleString()}
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    disabled={syncMutation.isPending}
                    onClick={handleSyncNow}
                  >
                    {syncMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Sync Now
                  </Button>
                  {syncMutation.isPending && (
                    <span className="text-xs text-muted-foreground">
                      Processing…
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Calendar Views */}
        {view === "month" && (
          <div className="grid grid-cols-7 gap-1 mb-6">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div
                key={d}
                className="text-center text-xs font-semibold text-muted-foreground py-1"
              >
                {d}
              </div>
            ))}
            {days.map((day) => {
              const dayEvents = events.filter((e) =>
                isSameDay(parseISO(e.startAt), day),
              );
              return (
                <div
                  key={day.toISOString()}
                  className="min-h-[100px] border rounded p-2 text-xs"
                >
                  <div className="font-medium mb-1">{format(day, "d")}</div>
                  {dayEvents.map((e) => {
                    const reminder = remindersByEventId.get(e.id);
                    const hasReminder = !!reminder;
                    return (
                      <div
                        key={e.id}
                        className={`truncate mb-1 rounded px-1 py-0.5 border cursor-pointer flex items-center justify-between gap-1 ${
                          e.status === "cancelled"
                            ? "bg-muted/50 text-muted-foreground line-through"
                            : "bg-primary/10 text-primary border-primary/20"
                        }`}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setSelectedEventId(e.id);
                        }}
                      >
                        <span>{e.title}</span>
                        <div className="flex items-center gap-1">
                          {getSyncStatus(e.id) !== "not_synced" && (
                            <SyncStatusBadge status={getSyncStatus(e.id)} />
                          )}
                          {hasReminder && (
                            <Bell
                              className="h-3 w-3 text-amber-500"
                              title="Has reminder"
                            />
                          )}
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              toggleBookmark(e.id);
                            }}
                            className="p-0.5 rounded hover:bg-primary/20 transition-colors"
                            aria-label={
                              isBookmarked(e.id)
                                ? "Remove bookmark"
                                : "Add bookmark"
                            }
                          >
                            {isBookmarked(e.id) ? (
                              <BookmarkCheck className="h-3 w-3 text-primary" />
                            ) : (
                              <Bookmark className="h-3 w-3 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {view === "week" && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Week View</h2>
            <p className="text-sm text-muted-foreground">
              Week view showing {filteredEvents.length} events this month.
            </p>
          </div>
        )}

        {view === "day" && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Day View</h2>
            <p className="text-sm text-muted-foreground">
              Day view showing {filteredEvents.length} events.
            </p>
          </div>
        )}

        {view === "bookmarks" && filteredEvents.length === 0 && (
          <div className="mb-6 text-center py-12">
            <Bookmark className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No bookmarks yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Click the bookmark icon on any event to save it here.
            </p>
          </div>
        )}

        {view === "reminders" && filteredEvents.length === 0 && (
          <div className="mb-6 text-center py-12">
            <BellOff className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No reminders set</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Open an event and add a reminder to get notified before it starts.
            </p>
          </div>
        )}

        {/* Events List with Sync Status */}
        <section className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Upcoming Events</h2>
          <ul className="space-y-2">
            {events.slice(0, 30).map((e) => {
              const mapping = mappingByEventId.get(e.id);
              const isSynced = mapping?.syncStatus === "synced";
              const canToggleSync = Boolean(connection?.connected);
              const bookmarked = isBookmarked(e.id);
              const reminder = remindersByEventId.get(e.id);
              const hasReminder = !!reminder;
              return (
                <li
                  key={e.id}
                  className="border rounded p-3 flex items-center justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-medium truncate">
                        {e.status === "cancelled" ? (
                          <span className="line-through text-muted-foreground">
                            {e.title}
                          </span>
                        ) : (
                          e.title
                        )}
                      </div>
                      {e.status === "cancelled" && (
                        <span className="text-xs text-muted-foreground">
                          (cancelled)
                        </span>
                      )}
                      {hasReminder && (
                        <Bell
                          className="h-3.5 w-3.5 text-amber-500"
                          title="Has reminder"
                        />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(parseISO(e.startAt), "PPp")} · {e.category}
                      {e.targetAudience !== "all" &&
                        ` · Year ${e.targetAudience}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <SyncStatusBadge status={getSyncStatus(e.id)} />
                    {canToggleSync && e.status !== "cancelled" ? (
                      <Switch
                        checked={isEventSynced(e.id)}
                        onCheckedChange={(checked) =>
                          handleToggleSync(e.id, checked)
                        }
                        disabled={
                          syncMutation.isPending || toggleSyncMutation.isPending
                        }
                      />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => toggleBookmark(e.id)}
                      disabled={
                        createBookmarkMutation.isPending ||
                        deleteBookmarkMutation.isPending
                      }
                      className="p-1.5 rounded hover:bg-secondary transition-colors"
                      aria-label={
                        bookmarked ? "Remove bookmark" : "Add bookmark"
                      }
                    >
                      {bookmarked ? (
                        <BookmarkCheck className="h-4 w-4 text-primary" />
                      ) : (
                        <Bookmark className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Event Details Dialog */}
        {selectedEventId && (
          <EventDetailsDialog
            eventId={selectedEventId}
            onClose={() => setSelectedEventId(null)}
            onSyncToggle={(enabled) => {
              setSelectedEventId(null);
              handleToggleSync(selectedEventId!, enabled);
            }}
            onBookmarkToggle={() => {
              toggleBookmark(selectedEventId!);
            }}
            isBookmarked={isBookmarked(selectedEventId!)}
          />
        )}
      </main>
    </div>
  );

  function navigateToGoogleConnect() {
    window.location.assign("/api/google/oauth/start");
  }
}

function EventDetailsDialog({
  eventId,
  onClose,
  onSyncToggle,
  onBookmarkToggle,
  isBookmarked,
}: {
  eventId: string;
  onClose: () => void;
  onSyncToggle: (enabled: boolean) => void;
  onBookmarkToggle: () => void;
  isBookmarked: boolean;
}) {
  const queryClient = useQueryClient();
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(
    null,
  );
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderNotes, setReminderNotes] = useState("");
  const [reminderOffset, setReminderOffset] = useState(60); // 1 hour default
  const [reminderChannel, setReminderChannel] = useState<"in_app" | "email">(
    "in_app",
  );

  const { data: event } = useQuery({
    queryKey: ["calendar-event", eventId],
    queryFn: async () => {
      const events = await listCalendarEvents();
      return events.find((e) => e.id === eventId) ?? null;
    },
    enabled: Boolean(eventId),
  });

  const { data: reminders = [] } = useQuery({
    queryKey: ["calendar-reminders"],
    queryFn: () => listReminders(),
  });

  const eventReminders = reminders.filter((r) => r.eventId === eventId);

  const mapping = useQuery({
    queryKey: ["event-sync-mappings"],
    queryFn: () => getEventSyncMappings(),
  }).data?.find((m) => m.eventId === eventId);

  const offsetOptions = getReminderOffsetOptions();

  const createReminderMutation = useMutation({
    mutationFn: (data: {
      title: string;
      notes: string | null;
      remindAt: string;
      eventId: string | null;
      channel: "in_app" | "email";
    }) => createReminder({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-reminders"] });
      toast.success("Reminder created");
      setShowReminderForm(false);
      setReminderTitle("");
      setReminderNotes("");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to create reminder");
    },
  });

  const updateReminderMutation = useMutation({
    mutationFn: (data: {
      reminderId: string;
      title?: string;
      notes?: string | null;
      remindAt?: string;
      channel?: "in_app" | "email";
      status?: "pending" | "sent" | "cancelled";
    }) => updateReminder({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-reminders"] });
      toast.success("Reminder updated");
      setEditingReminderId(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update reminder");
    },
  });

  const deleteReminderMutation = useMutation({
    mutationFn: (reminderId: string) =>
      deleteReminder({ data: { reminderId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-reminders"] });
      toast.success("Reminder deleted");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete reminder");
    },
  });

  const handleCreateReminder = () => {
    if (!event || !reminderTitle.trim()) return;
    const remindAt = calculateRemindAt(event.startAt, reminderOffset);
    if (new Date(remindAt) >= new Date(event.startAt)) {
      toast.error("Reminder must be before event start time");
      return;
    }
    createReminderMutation.mutate({
      title: reminderTitle.trim(),
      notes: reminderNotes.trim() || null,
      remindAt,
      eventId: event.id,
      channel: reminderChannel,
    });
  };

  const handleUpdateReminder = (reminder: (typeof reminders)[0]) => {
    if (!reminderTitle.trim()) return;
    const remindAt = calculateRemindAt(event!.startAt, reminderOffset);
    if (new Date(remindAt) >= new Date(event!.startAt)) {
      toast.error("Reminder must be before event start time");
      return;
    }
    updateReminderMutation.mutate({
      reminderId: reminder.reminderId,
      title: reminderTitle.trim(),
      notes: reminderNotes.trim() || null,
      remindAt,
      channel: reminderChannel,
    });
  };

  const handleEditReminder = (reminder: (typeof reminders)[0]) => {
    setEditingReminderId(reminder.reminderId);
    setReminderTitle(reminder.title);
    setReminderNotes(reminder.notes || "");
    // Calculate offset from remindAt and event startAt
    if (event) {
      const eventStart = new Date(event.startAt).getTime();
      const remindAt = new Date(reminder.remindAt).getTime();
      const diffMinutes = Math.round((eventStart - remindAt) / 60000);
      const matchedOption = offsetOptions.find(
        (o) => o.minutes === diffMinutes,
      );
      setReminderOffset(matchedOption?.minutes || 60);
    }
    setReminderChannel(reminder.channel as "in_app" | "email");
    setShowReminderForm(true);
  };

  const handleCancelReminderForm = () => {
    setShowReminderForm(false);
    setEditingReminderId(null);
    setReminderTitle("");
    setReminderNotes("");
    setReminderOffset(60);
    setReminderChannel("in_app");
  };

  const handleDeleteReminder = (reminderId: string) => {
    if (confirm("Delete this reminder?")) {
      deleteReminderMutation.mutate(reminderId);
    }
  };

  if (!event) return null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{event.title}</DialogTitle>
          <DialogDescription>
            {event.description || "No description available."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Category</span>
            <span>{event.category}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Visibility</span>
            <span>{event.visibility}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Target Audience</span>
            <span>
              {event.targetAudience === "all"
                ? "All Years"
                : `Year ${event.targetAudience}`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Starts</span>
            <span>{new Date(event.startAt).toLocaleString()}</span>
          </div>
          {event.endAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ends</span>
              <span>{new Date(event.endAt).toLocaleString()}</span>
            </div>
          )}
          {event.location && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Location</span>
              <span>{event.location}</span>
            </div>
          )}
        </div>

        {/* Reminders Section */}
        <div className="border-t pt-4 mt-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Bell className="h-4 w-4" /> Reminders
          </h3>

          {eventReminders.length > 0 ? (
            <div className="space-y-2">
              {eventReminders.map((reminder) => (
                <div
                  key={reminder.reminderId}
                  className="border rounded p-3 bg-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{reminder.title}</p>
                      {reminder.notes && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {reminder.notes}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(reminder.remindAt).toLocaleString()} ·
                        {reminder.channel === "email" ? "Email" : "In-app"}
                        {reminder.status !== "pending" &&
                          ` · ${reminder.status}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleEditReminder(reminder)}
                        className="p-1.5 rounded hover:bg-secondary transition-colors"
                        aria-label="Edit reminder"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteReminder(reminder.reminderId)
                        }
                        disabled={deleteReminderMutation.isPending}
                        className="p-1.5 rounded hover:bg-destructive/10 text-destructive transition-colors"
                        aria-label="Delete reminder"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No reminders for this event yet.
            </p>
          )}

          <div className="mt-4">
            {showReminderForm ? (
              <div className="space-y-3 border rounded p-4 bg-card">
                <h4 className="font-medium">
                  {editingReminderId ? "Edit Reminder" : "Add Reminder"}
                </h4>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      value={reminderTitle}
                      onChange={(e) => setReminderTitle(e.target.value)}
                      placeholder="e.g. Exam tomorrow"
                      className="w-full rounded border bg-background px-3 py-2 text-sm"
                      maxLength={200}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Notes (optional)
                    </label>
                    <textarea
                      value={reminderNotes}
                      onChange={(e) => setReminderNotes(e.target.value)}
                      placeholder="Additional notes..."
                      className="w-full rounded border bg-background px-3 py-2 text-sm"
                      maxLength={5000}
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      When to remind
                    </label>
                    <select
                      value={reminderOffset}
                      onChange={(e) =>
                        setReminderOffset(Number(e.target.value))
                      }
                      className="w-full rounded border bg-background px-3 py-2 text-sm"
                    >
                      {offsetOptions.map((opt) => (
                        <option key={opt.minutes} value={opt.minutes}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Event starts: {new Date(event.startAt).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Notification channel
                    </label>
                    <select
                      value={reminderChannel}
                      onChange={(e) =>
                        setReminderChannel(e.target.value as "in_app" | "email")
                      }
                      className="w-full rounded border bg-background px-3 py-2 text-sm"
                    >
                      <option value="in_app">In-app only</option>
                      <option value="email">Email</option>
                    </select>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={handleCancelReminderForm}
                      disabled={
                        createReminderMutation.isPending ||
                        updateReminderMutation.isPending
                      }
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={
                        editingReminderId
                          ? () => {
                              const reminder = eventReminders.find(
                                (r) => r.reminderId === editingReminderId,
                              );
                              if (reminder) handleUpdateReminder(reminder);
                            }
                          : handleCreateReminder
                      }
                      disabled={
                        createReminderMutation.isPending ||
                        updateReminderMutation.isPending ||
                        !reminderTitle.trim()
                      }
                      className="flex-1"
                    >
                      {editingReminderId ? "Save Changes" : "Create Reminder"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <Button
                onClick={() => setShowReminderForm(true)}
                className="w-full"
                variant="outline"
              >
                <Bell className="h-3.5 w-3.5 mr-1.5" /> Add Reminder
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <button onClick={onClose} className="btn-outline">
            Close
          </button>
          <button
            type="button"
            onClick={onBookmarkToggle}
            className={`btn-outline flex items-center gap-1.5 ${
              isBookmarked ? "text-primary" : ""
            }`}
          >
            {isBookmarked ? (
              <BookmarkCheck className="h-3.5 w-3.5" />
            ) : (
              <Bookmark className="h-3.5 w-3.5" />
            )}
            {isBookmarked ? "Remove Bookmark" : "Add Bookmark"}
          </button>
          {mapping && (
            <button
              onClick={() => onSyncToggle(mapping.syncStatus !== "synced")}
              className="btn-primary"
            >
              {mapping.syncStatus === "synced"
                ? "Remove from Google"
                : "Add to Google"}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
