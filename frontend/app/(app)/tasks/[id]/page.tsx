"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Paperclip, Send, Trash2, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { api, statusOptions, websocketUrl, type Attachment, type TaskDetail, type TaskStatus } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate, formatStatus } from "@/lib/utils";

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const taskId = params.id;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const socketRef = useRef<WebSocket | null>(null);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const task = useQuery({
    queryKey: ["task", taskId],
    queryFn: async () => (await api.get<TaskDetail>(`/tasks/${taskId}`)).data
  });

  useEffect(() => {
    if (!taskId) return;
    const socket = new WebSocket(websocketUrl(taskId));
    socketRef.current = socket;
    socket.onmessage = () => {
      void queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    };
    return () => socket.close();
  }, [queryClient, taskId]);

  const updateStatus = useMutation({
    mutationFn: async (status: TaskStatus) => api.patch(`/tasks/${taskId}/status`, { status }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    }
  });

  const sendMessage = useMutation({
    mutationFn: async (message: string) => api.post(`/tasks/${taskId}/messages`, { message }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["task", taskId] })
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) return;
      const body = new FormData();
      body.append("file", file);
      return api.post(`/tasks/${taskId}/attachments`, body, {
        headers: { "Content-Type": "multipart/form-data" }
      });
    },
    onSuccess: async () => {
      setFile(null);
      await queryClient.invalidateQueries({ queryKey: ["task", taskId] });
    }
  });

  const removeAttachment = useMutation({
    mutationFn: async (attachmentId: string) => api.delete(`/tasks/${taskId}/attachments/${attachmentId}`),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["task", taskId] })
  });

  function submitMessage(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ message: text }));
      setDraft("");
      return;
    }
    sendMessage.mutate(text);
    setDraft("");
  }

  if (task.isLoading) return <p className="text-sm text-muted-foreground">Loading task...</p>;
  if (task.isError || !task.data) return <p className="text-sm text-destructive">Task could not be loaded.</p>;

  const data = task.data;
  const canDeleteAttachment = (attachment: Attachment) => user?.role === "admin" || attachment.uploaded_by === user?.id;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/tasks" className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to tasks
          </Link>
          <h1 className="max-w-4xl truncate text-2xl font-semibold">{data.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.agency?.name ?? "No agency"} - {data.assigned_user?.name ?? "No direct assignee"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={data.priority}>{formatStatus(data.priority)}</Badge>
          <Badge tone={data.status}>{formatStatus(data.status)}</Badge>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Task Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="whitespace-pre-wrap text-sm leading-6">{data.description}</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Info label="Agency" value={data.agency?.name ?? "-"} />
                <Info label="Assigned User" value={data.assigned_user?.name ?? "-"} />
                <Info label="Due Date" value={formatDate(data.due_date)} />
                <Info label="Created" value={formatDate(data.created_at)} />
              </div>
              <label className="block max-w-xs space-y-2 text-sm font-medium">
                <span>Status</span>
                <Select value={data.status} onChange={(event) => updateStatus.mutate(event.target.value as TaskStatus)}>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {formatStatus(status)}
                    </option>
                  ))}
                </Select>
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Messages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-[440px] space-y-3 overflow-y-auto pr-1">
                {data.messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No messages yet.</p>
                ) : (
                  data.messages.map((message) => (
                    <div key={message.id} className="rounded-md border bg-background p-3">
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">{message.sender?.name ?? "Unknown user"}</p>
                        <span className="text-xs text-muted-foreground">{formatDate(message.created_at)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6">{message.message}</p>
                    </div>
                  ))
                )}
              </div>
              <form className="flex gap-2" onSubmit={submitMessage}>
                <Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message" />
                <Button type="submit" disabled={!draft.trim()}>
                  <Send className="h-4 w-4" />
                  Send
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Attachments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="block space-y-2 text-sm font-medium">
                <span>Upload file</span>
                <Input
                  type="file"
                  accept="image/*,.pdf,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </label>
              <Button className="w-full" onClick={() => upload.mutate()} disabled={!file || upload.isPending}>
                <Upload className="h-4 w-4" />
                {upload.isPending ? "Uploading..." : "Upload"}
              </Button>
              <div className="space-y-2">
                {data.attachments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No files uploaded.</p>
                ) : (
                  data.attachments.map((attachment) => (
                    <div key={attachment.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{attachment.file_name}</p>
                        <p className="text-xs text-muted-foreground">{Math.ceil(attachment.size_bytes / 1024)} KB</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <a
                          href={attachment.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted"
                          title="Download"
                        >
                            <Download className="h-4 w-4" />
                        </a>
                        {canDeleteAttachment(attachment) && (
                          <Button size="icon" variant="ghost" title="Delete" onClick={() => removeAttachment.mutate(attachment.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {data.activity_logs.map((item) => (
                  <li key={item.id} className="flex gap-3">
                    <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary">
                      <Paperclip className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.user?.name ?? "System"} - {formatDate(item.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-medium">{value}</p>
    </div>
  );
}
