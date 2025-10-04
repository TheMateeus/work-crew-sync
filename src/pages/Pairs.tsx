import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface Employee {
  id: string;
  name: string;
  active: boolean;
}

interface Pair {
  id: string;
  label: string;
  pair_members: Array<{
    employee: Employee;
  }>;
}

export default function Pairs() {
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPair, setEditingPair] = useState<Pair | null>(null);
  const [formData, setFormData] = useState({
    label: "",
    employee1: "",
    employee2: "",
  });
  const { profile } = useAuth();

  const canEdit = profile?.role === "ADMIN" || profile?.role === "MANAGER";

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [pairsRes, employeesRes] = await Promise.all([
        supabase
          .from("pairs")
          .select(`
            *,
            pair_members(
              employee:employees(*)
            )
          `)
          .order("label"),
        supabase
          .from("employees")
          .select("*")
          .eq("active", true)
          .order("name"),
      ]);

      if (pairsRes.error) throw pairsRes.error;
      if (employeesRes.error) throw employeesRes.error;

      setPairs(pairsRes.data || []);
      setEmployees(employeesRes.data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar dados: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.employee1 || !formData.employee2) {
      toast.error("Selecione dois funcionários");
      return;
    }

    if (formData.employee1 === formData.employee2) {
      toast.error("Selecione funcionários diferentes");
      return;
    }

    try {
      if (editingPair) {
        // Update pair
        const { error: pairError } = await supabase
          .from("pairs")
          .update({ label: formData.label })
          .eq("id", editingPair.id);

        if (pairError) throw pairError;

        // Delete old members
        const { error: deleteError } = await supabase
          .from("pair_members")
          .delete()
          .eq("pair_id", editingPair.id);

        if (deleteError) throw deleteError;

        // Add new members
        const { error: membersError } = await supabase
          .from("pair_members")
          .insert([
            { pair_id: editingPair.id, employee_id: formData.employee1 },
            { pair_id: editingPair.id, employee_id: formData.employee2 },
          ]);

        if (membersError) throw membersError;

        toast.success("Dupla atualizada!");
      } else {
        // Create pair
        const { data: pair, error: pairError } = await supabase
          .from("pairs")
          .insert([{ label: formData.label }])
          .select()
          .single();

        if (pairError) throw pairError;

        // Add members
        const { error: membersError } = await supabase
          .from("pair_members")
          .insert([
            { pair_id: pair.id, employee_id: formData.employee1 },
            { pair_id: pair.id, employee_id: formData.employee2 },
          ]);

        if (membersError) throw membersError;

        toast.success("Dupla cadastrada!");
      }

      setDialogOpen(false);
      setEditingPair(null);
      setFormData({ label: "", employee1: "", employee2: "" });
      fetchData();
    } catch (error: any) {
      toast.error("Erro: " + error.message);
    }
  };

  const handleEdit = (pair: Pair) => {
    setEditingPair(pair);
    setFormData({
      label: pair.label,
      employee1: pair.pair_members[0]?.employee.id || "",
      employee2: pair.pair_members[1]?.employee.id || "",
    });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Duplas</h1>
          <p className="text-muted-foreground">Gerencie as duplas de trabalho</p>
        </div>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingPair(null);
                setFormData({ label: "", employee1: "", employee2: "" });
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Dupla
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>{editingPair ? "Editar Dupla" : "Nova Dupla"}</DialogTitle>
                  <DialogDescription>
                    {editingPair ? "Edite" : "Crie"} uma dupla selecionando dois funcionários
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="label">Nome da Dupla</Label>
                    <Input
                      id="label"
                      value={formData.label}
                      onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                      placeholder="Ex: Dupla A"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employee1">Funcionário 1</Label>
                    <Select
                      value={formData.employee1}
                      onValueChange={(value) => setFormData({ ...formData, employee1: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employee2">Funcionário 2</Label>
                    <Select
                      value={formData.employee2}
                      onValueChange={(value) => setFormData({ ...formData, employee2: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">{editingPair ? "Salvar" : "Criar Dupla"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : pairs.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhuma dupla cadastrada</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          pairs.map((pair) => (
            <Card key={pair.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    {pair.label}
                  </div>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(pair)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pair.pair_members.map((member, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <div className="h-2 w-2 rounded-full bg-primary"></div>
                      <span>{member.employee.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
