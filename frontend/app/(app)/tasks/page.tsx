"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Plus, Search, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, priorityOptions, statusOptions, type Agency, type Task, type TaskPriority, type TaskStatus, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn, formatDate, formatStatus } from "@/lib/utils";

const emptyForm = {
  id: "",
  title: "",
  description: "",
  status: "pending" as TaskStatus,
  priority: "normal" as TaskPriority,
  agency_id: "",
  assigned_user_id: "",
  due_date: ""
};

export default function TasksPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [agencyId, setAgencyId] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [form, setForm] = useState(emptyForm);

  const tasks = useQuery({
    queryKey: ["tasks", search, status, agencyId, assignedUserId],
    queryFn: async () =>
      (
        await api.get<Task[]>("/tasks", {
          params: {
            search: search || undefined,
            status: status || undefined,
            agency_id: agencyId || undefined,
            assigned_user_id: assignedUserId || undefined
          }
        })
      ).data
  });
  const agencies = useQuery({
    queryKey: ["agencies"],
    queryFn: async () => (await api.get<Agency[]>("/agencies")).data,
    enabled: user?.role === "admin"
  });
  const users = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.get<User[]>("/users")).data,
    enabled: user?.role === "admin"
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        description: form.description,
        status: form.status,
        priority: form.priority,
        agency_id: form.agency_id || null,
        assigned_user_id: form.assigned_user_id || null,
        due_date: form.due_date ? new Date(`${form.due_date}T12:00:00`).toISOString() : null
      };
      if (form.id) return api.patch(`/tasks/${form.id}`, payload);
      return api.post("/tasks", payload);
    },
    onSuccess: async () => {
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["tasks"] })
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, nextStatus }: { id: string; nextStatus: TaskStatus }) => api.patch(`/tasks/${id}/status`, { status: nextStatus }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["tasks"] })
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (form.title.trim() && form.description.trim()) save.mutate();
  }

  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tasks</h1>
          <p className="text-sm text-muted-foreground">Create, assign, filter, and track work across internal and partner teams.</p>
        </div>
        {form.id && (
          <Button variant="outline" onClick={() => setForm(emptyForm)}>
            <X className="h-4 w-4" />
            Cancel edit
          </Button>
        )}
      </div>
      <div className={isAdmin ? "grid gap-6 xl:grid-cols-[420px_1fr]" : "space-y-4"}>
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>{form.id ? "Edit Task" : "Create Task"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={submit}>
                <label className="block space-y-2 text-sm font-medium">
                  <span>Title</span>
                  <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
                </label>
                <label className="block space-y-2 text-sm font-medium">
                  <span>Description</span>
                  <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-2 text-sm font-medium">
                    <span>Status</span>
                    <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as TaskStatus })}>
                      {statusOptions.map((option) => (
                        <option key={option} value={option}>
                          {formatStatus(option)}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="block space-y-2 text-sm font-medium">
                    <span>Priority</span>
                    <Select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as TaskPriority })}>
                      {priorityOptions.map((option) => (
                        <option key={option} value={option}>
                          {formatStatus(option)}
                        </option>
                      ))}
                    </Select>
                  </label>
                </div>
                <label className="block space-y-2 text-sm font-medium">
                  <span>Agency</span>
                  <Select value={form.agency_id} onChange={(event) => setForm({ ...form, agency_id: event.target.value })}>
                    <option value="">No agency</option>
                    {(agencies.data ?? []).map((agency) => (
                      <option key={agency.id} value={agency.id}>
                        {agency.name}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="block space-y-2 text-sm font-medium">
                  <span>Assigned User</span>
                  <Select value={form.assigned_user_id} onChange={(event) => setForm({ ...form, assigned_user_id: event.target.value })}>
                    <option value="">No direct assignee</option>
                    {(users.data ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.role})
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="block space-y-2 text-sm font-medium">
                  <span>Due Date</span>
                  <Input type="date" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} />
                </label>
                <Button className="w-full" disabled={save.isPending}>
                  <Plus className="h-4 w-4" />
                  {save.isPending ? "Saving..." : form.id ? "Save Changes" : "Create Task"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
        <section className="space-y-3">
          <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-5">
            <div className="relative md:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search tasks" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All statuses</option>
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {formatStatus(option)}
                </option>
              ))}
            </Select>
            {isAdmin && (
              <Select value={agencyId} onChange={(event) => setAgencyId(event.target.value)}>
                <option value="">All agencies</option>
                {(agencies.data ?? []).map((agency) => (
                  <option key={agency.id} value={agency.id}>
                    {agency.name}
                  </option>
                ))}
              </Select>
            )}
            {isAdmin && (
              <Select value={assignedUserId} onChange={(event) => setAssignedUserId(event.target.value)}>
                <option value="">All assignees</option>
                {(users.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            )}
          </div>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Task</th>
                  <th className="px-4 py-3">Agency</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Assigned</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(tasks.data ?? []).map((task) => (
                  <tr key={task.id}>
                    <td className="px-4 py-3">
                      <div className="max-w-xs truncate font-medium">{task.title}</div>
                      <div className="max-w-xs truncate text-xs text-muted-foreground">{task.description}</div>
                    </td>
                    <td className="px-4 py-3">{task.agency?.name ?? "-"}</td>
                    <td className="px-4 py-3">
                      <Select
                        value={task.status}
                        className="h-8 min-w-40"
                        onChange={(event) => updateStatus.mutate({ id: task.id, nextStatus: event.target.value as TaskStatus })}
                      >
                        {statusOptions.map((option) => (
                          <option key={option} value={option}>
                            {formatStatus(option)}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={task.priority}>{formatStatus(task.priority)}</Badge>
                    </td>
                    <td className="px-4 py-3">{formatDate(task.due_date)}</td>
                    <td className="px-4 py-3">{task.assigned_user?.name ?? "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/tasks/${task.id}`}
                          aria-label="View task"
                          title="View"
                          className={cn("inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted")}
                        >
                            <Eye className="h-4 w-4" />
                        </Link>
                        {isAdmin && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Edit"
                              onClick={() =>
                                setForm({
                                  id: task.id,
                                  title: task.title,
                                  description: task.description,
                                  status: task.status,
                                  priority: task.priority,
                                  agency_id: task.agency_id ?? "",
                                  assigned_user_id: task.assigned_user_id ?? "",
                                  due_date: task.due_date ? task.due_date.slice(0, 10) : ""
                                })
                              }
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" title="Delete" onClick={() => remove.mutate(task.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!tasks.isLoading && (tasks.data?.length ?? 0) === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>
                      No tasks found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
