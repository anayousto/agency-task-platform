"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { api, roleOptions, type Agency, type Role, type User } from "@/lib/api";

const emptyForm = {
  id: "",
  name: "",
  email: "",
  password: "",
  role: "employee" as Role,
  agency_id: ""
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);

  const users = useQuery({
    queryKey: ["users", search],
    queryFn: async () => (await api.get<User[]>("/users", { params: { search: search || undefined } })).data
  });
  const agencies = useQuery({
    queryKey: ["agencies"],
    queryFn: async () => (await api.get<Agency[]>("/agencies")).data
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        role: form.role,
        agency_id: form.agency_id || null
      };
      if (form.password) payload.password = form.password;
      if (form.id) return api.patch(`/users/${form.id}`, payload);
      return api.post("/users", payload);
    },
    onSuccess: async () => {
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    }
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/users/${id}`),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["users"] })
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (form.name && form.email && (form.id || form.password)) save.mutate();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground">Create internal users and partner agency accounts.</p>
        </div>
        {form.id && (
          <Button variant="outline" onClick={() => setForm(emptyForm)}>
            <X className="h-4 w-4" />
            Cancel edit
          </Button>
        )}
      </div>
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{form.id ? "Edit User" : "Create User"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submit}>
              <label className="block space-y-2 text-sm font-medium">
                <span>Name</span>
                <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                <span>Email</span>
                <Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                <span>Password</span>
                <Input
                  type="password"
                  placeholder={form.id ? "Leave blank to keep current password" : ""}
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                <span>Role</span>
                <Select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })}>
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </Select>
              </label>
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
              <Button className="w-full" disabled={save.isPending}>
                <Plus className="h-4 w-4" />
                {save.isPending ? "Saving..." : form.id ? "Save Changes" : "Create User"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <section className="space-y-3">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search users" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Agency</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(users.data ?? []).map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{user.name}</div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge>{user.role}</Badge>
                    </td>
                    <td className="px-4 py-3">{user.agency?.name ?? "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Edit"
                          onClick={() =>
                            setForm({
                              id: user.id,
                              name: user.name,
                              email: user.email,
                              password: "",
                              role: user.role,
                              agency_id: user.agency_id ?? ""
                            })
                          }
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Delete" onClick={() => remove.mutate(user.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!users.isLoading && (users.data?.length ?? 0) === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-muted-foreground" colSpan={4}>
                      No users found.
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
