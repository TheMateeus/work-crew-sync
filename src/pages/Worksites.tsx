import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface Worksite {
  id: string;
  name: string;
  address: string | null;
  note: string | null;
}

export default function Worksites() {
  const [worksites, setWorksites] = useState<Worksite[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWorksite, setEditingWorksite] = useState<Worksite | null>(null);
  const [formData, setFormData] = useState({ name: "", address: "", note: "" });
  const { profile } = useAuth();

  const canEdit = profile?.role === "ADMIN" || profile?.role === "MANAGER";

  useEffect(() => {
    fetchWorksites();
  }, []);

  const fetchWorksites = async () => {
    try {
      const { data, error } = await supabase
        .from("worksites")
        .select("*")
        .order("name");

      if (error) throw error;
      setWorksites(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar obras: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingWorksite) {
        const { error } = await supabase
          .from("worksites")
          .update({
            name: formData.name,
            address: formData.address || null,
            note: formData.note || null,
          })
          .eq("id", editingWorksite.id);

        if (error) throw error;
        toast.success("Obra atualizada!");
      } else {
        const { error } = await supabase
          .from("worksites")
          .insert([{
            name: formData.name,
            address: formData.address || null,
            note: formData.note || null,
          }]);

        if (error) throw error;
        toast.success("Obra cadastrada!");
      }

      setDialogOpen(false);
      setFormData({ name: "", address: "", note: "" });
      setEditingWorksite(null);
      fetchWorksites();
    } catch (error: any) {
      toast.error("Erro: " + error.message);
    }
  };

  const handleEdit = (worksite: Worksite) => {
    setEditingWorksite(worksite);
    setFormData({
      name: worksite.name,
      address: worksite.address || "",
      note: worksite.note || "",
    });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Obras</h1>
          <p className="text-muted-foreground">Gerencie as obras da empresa</p>
        </div>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingWorksite(null); setFormData({ name: "", address: "", note: "" }); }}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Obra
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>
                    {editingWorksite ? "Editar Obra" : "Nova Obra"}
                  </DialogTitle>
                  <DialogDescription>
                    Preencha os dados da obra
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome da Obra</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Endereço</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="note">Observações</Label>
                    <Textarea
                      id="note"
                      value={formData.note}
                      onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Salvar</Button>
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
        ) : worksites.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground">Nenhuma obra cadastrada</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          worksites.map((worksite) => (
            <Card key={worksite.id}>
              <CardHeader>
                <CardTitle>{worksite.name}</CardTitle>
                {worksite.address && (
                  <CardDescription>{worksite.address}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {worksite.note && (
                  <p className="text-sm text-muted-foreground">{worksite.note}</p>
                )}
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleEdit(worksite)}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
