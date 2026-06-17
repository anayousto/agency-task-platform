"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, type Agency } from "@/lib/api";

const emptyForm = {
  id: "",
  name: "",
  logo_url: "",
  contact_email: "",
  phone: ""
};

export default function AgenciesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);

  const agencies = useQuery({
    queryKey: ["agencies", search],
    queryFn: async () => (await api.get<Agency[]>("/agencies", { params: { search: search || undefined } })).data
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        logo_url: form.logo_url || null,
        contact_email: form.contact_email || null,
        phone: form.phone || null
      };
      if (form.id) return api.patch(`/agencies/${form.id}`, payload);
      return api.post("/agencies", payload);
    },
    onSuccess: async () => {
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ["agencies"] });
    }
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/agencies/${id}`),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["agencies"] })
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (form.name.trim()) save.mutate();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Agencies</h1>
          <p className="text-sm text-muted-foreground">Manage partner agencies and their contact details.</p>
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
            <CardTitle>{form.id ? "Edit Agency" : "Create Agency"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submit}>
              <label className="block space-y-2 text-sm font-medium">
                <span>Name</span>
                <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                <span>Logo URL</span>
                <Input value={form.logo_url} onChange={(event) => setForm({ ...form, logo_url: event.target.value })} />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                <span>Contact Email</span>
                <Input
                  type="email"
                  value={form.contact_email}
                  onChange={(event) => setForm({ ...form, contact_email: event.target.value })}
                />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                <span>Phone</span>
                <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              </label>
              <Button className="w-full" disabled={save.isPending}>
                <Plus className="h-4 w-4" />
                {save.isPending ? "Saving..." : form.id ? "Save Changes" : "Create Agency"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <section className="space-y-3">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search agencies" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Agency</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(agencies.data ?? []).map((agency) => (
                  <tr key={agency.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{agency.name}</div>
                      <div className="text-xs text-muted-foreground">{agency.logo_url || "No logo"}</div>
                    </td>
                    <td className="px-4 py-3">{agency.contact_email || "-"}</td>
                    <td className="px-4 py-3">{agency.phone || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Edit"
                          onClick={() =>
                            setForm({
                              id: agency.id,
                              name: agency.name,
                              logo_url: agency.logo_url ?? "",
                              contact_email: agency.contact_email ?? "",
                              phone: agency.phone ?? ""
                            })
                          }
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Delete" onClick={() => remove.mutate(agency.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!agencies.isLoading && (agencies.data?.length ?? 0) === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-muted-foreground" colSpan={4}>
                      No agencies found.
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
