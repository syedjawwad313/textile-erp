"use client";

import React, { useState } from "react";
import { PageHeader } from "../../../components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Dialog } from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { useToast } from "../../../components/ui/toast";
import {
  useDefectCatalog,
  useCreateDefectCatalog,
  useUpdateDefectCatalog,
} from "../../../hooks/use-defect-catalog";
import { DefectCategory, DefectSeverity, DefectCatalog } from "../../../lib/api/types";
import {
  AlertOctagon,
  Plus,
  Search,
  CheckCircle2,
  Filter,
  Layers,
  Edit2,
  Tag,
  ShieldAlert,
} from "lucide-react";

const CATEGORIES: DefectCategory[] = [
  "FABRIC",
  "CUTTING",
  "SEWING",
  "WASHING",
  "FINISHING",
  "PACKING",
  "MEASUREMENT",
  "GENERAL",
];

export default function DefectCatalogPage() {
  const toast = useToast();

  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: defects = [], isLoading } = useDefectCatalog({
    category: selectedCategory !== "ALL" ? selectedCategory : undefined,
    severity: selectedSeverity !== "ALL" ? selectedSeverity : undefined,
    search: searchQuery || undefined,
  });

  const createDefectMutation = useCreateDefectCatalog();
  const updateDefectMutation = useUpdateDefectCatalog();

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<DefectCategory>("SEWING");
  const [newSeverity, setNewSeverity] = useState<DefectSeverity>("MAJOR");
  const [newDescription, setNewDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Edit Modal
  const [editingDefect, setEditingDefect] = useState<DefectCatalog | null>(null);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!newCode.trim()) {
      setFormError("Defect code is required.");
      return;
    }
    if (!newName.trim()) {
      setFormError("Defect name is required.");
      return;
    }

    try {
      await createDefectMutation.mutateAsync({
        code: newCode.trim().toUpperCase(),
        name: newName.trim(),
        category: newCategory,
        defaultSeverity: newSeverity,
        description: newDescription.trim() || undefined,
        active: true,
      });

      toast.success("Defect code created successfully");
      setIsCreateOpen(false);
      setNewCode("");
      setNewName("");
      setNewDescription("");
    } catch (err: any) {
      setFormError(err.message || "Failed to create defect code");
    }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDefect) return;

    try {
      await updateDefectMutation.mutateAsync({
        id: editingDefect.id,
        data: {
          name: editingDefect.name,
          category: editingDefect.category,
          defaultSeverity: editingDefect.defaultSeverity,
          description: editingDefect.description || undefined,
          active: editingDefect.active,
        },
      });

      toast.success("Defect code updated successfully");
      setEditingDefect(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to update defect code");
    }
  };

  const getSeverityBadge = (severity: DefectSeverity) => {
    switch (severity) {
      case "CRITICAL":
        return <Badge variant="danger" className="font-mono text-xs">CRITICAL</Badge>;
      case "MAJOR":
        return <Badge variant="warning" className="font-mono text-xs">MAJOR</Badge>;
      case "MINOR":
        return <Badge variant="info" className="font-mono text-xs">MINOR</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const criticalCount = defects.filter((d) => d.defaultSeverity === "CRITICAL").length;
  const majorCount = defects.filter((d) => d.defaultSeverity === "MAJOR").length;
  const minorCount = defects.filter((d) => d.defaultSeverity === "MINOR").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Defect Master Catalog"
        description="Standardized apparel defect taxonomy, severity ratings, and inspection classifications"
        breadcrumbs={[
          { label: "Quality Control", href: "/production/quality" },
          { label: "Defect Catalog" },
        ]}
        actions={
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4" />
            Add Defect Code
          </Button>
        }
      />

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Defect Codes</p>
              <p className="text-2xl font-bold text-white mt-1">{defects.length}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Tag className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Critical Defects</p>
              <p className="text-2xl font-bold text-rose-400 mt-1">{criticalCount}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Major Defects</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">{majorCount}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <AlertOctagon className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Minor Defects</p>
              <p className="text-2xl font-bold text-sky-400 mt-1">{minorCount}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <Input
                  placeholder="Search code, defect name, or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-slate-950 border-slate-800 text-slate-200 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-400">Severity:</span>
              <Select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                options={[
                  { label: "All Severities", value: "ALL" },
                  { label: "Critical Only", value: "CRITICAL" },
                  { label: "Major Only", value: "MAJOR" },
                  { label: "Minor Only", value: "MINOR" },
                ]}
                className="w-40 bg-slate-950 border-slate-800 text-sm"
              />
            </div>
          </div>

          {/* Department Category Pills */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800/60">
            <button
              onClick={() => setSelectedCategory("ALL")}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                selectedCategory === "ALL"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              ALL DEPARTMENTS ({defects.length})
            </button>
            {CATEGORIES.map((cat) => {
              const count = defects.filter((d) => d.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                    selectedCategory === cat
                      ? "bg-blue-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  {cat} {count > 0 && `(${count})`}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Catalog Table */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-3 border-b border-slate-800">
          <CardTitle className="text-base text-slate-200 flex items-center justify-between">
            <span>Defect Directory</span>
            <span className="text-xs font-normal text-slate-500 font-mono">
              Showing {defects.length} active codes
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">Loading defect catalog...</div>
          ) : defects.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <AlertOctagon className="w-8 h-8 mx-auto text-slate-600" />
              <p>No defect codes found matching criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="text-xs font-semibold text-slate-400 uppercase bg-slate-950/60 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-3">Code</th>
                    <th className="px-6 py-3">Defect Name</th>
                    <th className="px-6 py-3">Department</th>
                    <th className="px-6 py-3">Default Severity</th>
                    <th className="px-6 py-3">Description</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {defects.map((defect) => (
                    <tr key={defect.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-blue-400">{defect.code}</td>
                      <td className="px-6 py-4 font-medium text-white">{defect.name}</td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="text-xs font-mono">
                          {defect.category}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">{getSeverityBadge(defect.defaultSeverity)}</td>
                      <td className="px-6 py-4 text-xs text-slate-400 max-w-xs truncate">
                        {defect.description || "—"}
                      </td>
                      <td className="px-6 py-4">
                        {defect.active ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingDefect(defect)}
                          className="text-slate-400 hover:text-white"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Defect Dialog */}
      <Dialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Defect Master Code"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-rose-400 text-xs">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Defect Code *
              </label>
              <Input
                placeholder="e.g. DEF-SEW-021"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                required
                className="bg-slate-950 border-slate-800 font-mono text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Department / Category *
              </label>
              <Select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as DefectCategory)}
                options={CATEGORIES.map((c) => ({ label: c, value: c }))}
                className="bg-slate-950 border-slate-800 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">
              Defect Name *
            </label>
            <Input
              placeholder="e.g. Broken Needle Mark"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              className="bg-slate-950 border-slate-800 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">
              Default Severity *
            </label>
            <Select
              value={newSeverity}
              onChange={(e) => setNewSeverity(e.target.value as DefectSeverity)}
              options={[
                { label: "MINOR (Cosmetic / Low Impact)", value: "MINOR" },
                { label: "MAJOR (Functional / Visible Defect)", value: "MAJOR" },
                { label: "CRITICAL (Safety Hazard / Immediate Rejection)", value: "CRITICAL" },
              ]}
              className="bg-slate-950 border-slate-800 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">
              Description / Inspection Standard
            </label>
            <Input
              placeholder="Description of defect cause and appearance criteria..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="bg-slate-950 border-slate-800 text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={createDefectMutation.isPending}
            >
              {createDefectMutation.isPending ? "Creating..." : "Create Defect"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Edit Defect Dialog */}
      <Dialog
        open={!!editingDefect}
        onClose={() => setEditingDefect(null)}
        title={`Edit Defect Code ${editingDefect?.code}`}
      >
        {editingDefect && (
          <form onSubmit={handleUpdateSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Defect Name *
              </label>
              <Input
                value={editingDefect.name}
                onChange={(e) => setEditingDefect({ ...editingDefect, name: e.target.value })}
                required
                className="bg-slate-950 border-slate-800 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Department / Category
                </label>
                <Select
                  value={editingDefect.category}
                  onChange={(e) => setEditingDefect({ ...editingDefect, category: e.target.value as DefectCategory })}
                  options={CATEGORIES.map((c) => ({ label: c, value: c }))}
                  className="bg-slate-950 border-slate-800 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Default Severity
                </label>
                <Select
                  value={editingDefect.defaultSeverity}
                  onChange={(e) => setEditingDefect({ ...editingDefect, defaultSeverity: e.target.value as DefectSeverity })}
                  options={[
                    { label: "MINOR", value: "MINOR" },
                    { label: "MAJOR", value: "MAJOR" },
                    { label: "CRITICAL", value: "CRITICAL" },
                  ]}
                  className="bg-slate-950 border-slate-800 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Description
              </label>
              <Input
                value={editingDefect.description || ""}
                onChange={(e) => setEditingDefect({ ...editingDefect, description: e.target.value })}
                className="bg-slate-950 border-slate-800 text-sm"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="editActive"
                checked={editingDefect.active}
                onChange={(e) => setEditingDefect({ ...editingDefect, active: e.target.checked })}
                className="rounded border-slate-700 bg-slate-900 text-blue-600"
              />
              <label htmlFor="editActive" className="text-sm font-medium text-slate-300">
                Active in Quality Terminals
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingDefect(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={updateDefectMutation.isPending}
              >
                {updateDefectMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
