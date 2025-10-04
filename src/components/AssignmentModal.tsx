import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

type Shift = Database["public"]["Enums"]["shift"];

interface AssignmentModalProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  assignment?: {
    id: string;
    date: string;
    start_date: string;
    end_date: string;
    shift: string;
    worksite_id: string;
    pair_id: string;
    note: string | null;
  } | null;
  initialDate?: string;
  canEdit: boolean;
}

interface Worksite {
  id: string;
  name: string;
}

interface Pair {
  id: string;
  label: string;
  members: { employee: { name: string; active: boolean } }[];
}

export default function AssignmentModal({
  open,
  onClose,
  onSave,
  assignment,
  initialDate,
  canEdit,
}: AssignmentModalProps) {
  const [loading, setLoading] = useState(false);
  const [worksites, setWorksites] = useState<Worksite[]>([]);
  const [pairs, setPairs] = useState<Pair[]>([]);
  
  const [startDate, setStartDate] = useState(initialDate || "");
  const [endDate, setEndDate] = useState(initialDate || "");
  const [worksiteId, setWorksiteId] = useState("");
  const [pairId, setPairId] = useState("");
  const [shift, setShift] = useState<Shift>("FULL");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      fetchWorksites();
      fetchPairs();
      
      if (assignment) {
        setStartDate(assignment.start_date || assignment.date);
        setEndDate(assignment.end_date || assignment.date);
        setWorksiteId(assignment.worksite_id);
        setPairId(assignment.pair_id);
        setShift(assignment.shift as Shift);
        setNote(assignment.note || "");
      } else if (initialDate) {
        setStartDate(initialDate);
        setEndDate(initialDate);
        setWorksiteId("");
        setPairId("");
        setShift("FULL");
        setNote("");
      }
    }
  }, [open, assignment, initialDate]);

  const fetchWorksites = async () => {
    const { data, error } = await supabase
      .from("worksites")
      .select("id, name")
      .order("name");
    
    if (error) {
      toast.error("Erro ao carregar obras");
      return;
    }
    setWorksites(data || []);
  };

  const fetchPairs = async () => {
    const { data, error } = await supabase
      .from("pairs")
      .select(`
        id, label,
        members:pair_members(
          employee:employees(name, active)
        )
      `)
      .order("label");
    
    if (error) {
      toast.error("Erro ao carregar duplas");
      return;
    }
    setPairs(data || []);
  };

  const handleSave = async () => {
    if (!startDate || !endDate || !worksiteId || !pairId) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      toast.error("A data final não pode ser anterior à data inicial");
      return;
    }

    // Verificar se a dupla tem membros inativos
    const selectedPair = pairs.find(p => p.id === pairId);
    const hasInactive = selectedPair?.members.some(m => !m.employee.active);
    
    if (hasInactive) {
      toast.error("Esta dupla contém funcionários inativos e não pode ser escalada");
      return;
    }

    setLoading(true);
    
    try {
      if (assignment) {
        // Editar
        const { error } = await supabase
          .from("assignments")
          .update({
            start_date: startDate,
            end_date: endDate,
            date: startDate, // mantém por compatibilidade
            worksite_id: worksiteId,
            pair_id: pairId,
            shift: shift as Shift,
            note: note || null,
          })
          .eq("id", assignment.id);

        if (error) {
          if (error.message.includes("duplicate") || error.message.includes("unique")) {
            toast.error("Já existe uma escala para esta dupla/obra/turno neste dia");
          } else {
            toast.error("Erro ao atualizar escala: " + error.message);
          }
          return;
        }
        toast.success("Escala atualizada com sucesso");
      } else {
        // Criar
        const { error } = await supabase
          .from("assignments")
          .insert({
            start_date: startDate,
            end_date: endDate,
            date: startDate, // mantém por compatibilidade
            worksite_id: worksiteId,
            pair_id: pairId,
            shift: shift as Shift,
            note: note || null,
          });

        if (error) {
          if (error.message.includes("duplicate") || error.message.includes("unique")) {
            toast.error("Já existe uma escala para esta dupla/obra/turno neste dia");
          } else {
            toast.error("Erro ao criar escala: " + error.message);
          }
          return;
        }
        toast.success("Escala criada com sucesso");
      }
      
      onSave();
      onClose();
    } catch (error: any) {
      toast.error("Erro inesperado: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!assignment) return;
    
    if (!confirm("Tem certeza que deseja excluir esta escala?")) return;

    setLoading(true);
    
    try {
      const { error } = await supabase
        .from("assignments")
        .delete()
        .eq("id", assignment.id);

      if (error) {
        toast.error("Erro ao excluir escala: " + error.message);
        return;
      }
      
      toast.success("Escala excluída com sucesso");
      onSave();
      onClose();
    } catch (error: any) {
      toast.error("Erro inesperado: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {assignment ? "Editar Escala" : "Nova Escala"}
          </DialogTitle>
          <DialogDescription>
            {canEdit ? "Preencha os dados da escala de trabalho" : "Visualização apenas"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="start-date">Data Início</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={!canEdit || loading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end-date">Data Fim</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={!canEdit || loading}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="worksite">Obra</Label>
            <Select
              value={worksiteId}
              onValueChange={setWorksiteId}
              disabled={!canEdit || loading}
            >
              <SelectTrigger id="worksite">
                <SelectValue placeholder="Selecione a obra" />
              </SelectTrigger>
              <SelectContent>
                {worksites.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id}>
                    {ws.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="pair">Dupla</Label>
            <Select
              value={pairId}
              onValueChange={setPairId}
              disabled={!canEdit || loading}
            >
              <SelectTrigger id="pair">
                <SelectValue placeholder="Selecione a dupla" />
              </SelectTrigger>
              <SelectContent>
                {pairs.map((pair) => {
                  const hasInactive = pair.members.some(m => !m.employee.active);
                  return (
                    <SelectItem 
                      key={pair.id} 
                      value={pair.id}
                      disabled={hasInactive}
                    >
                      {pair.label} {hasInactive && "(contém inativos)"}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Turno</Label>
            <RadioGroup
              value={shift}
              onValueChange={(v) => setShift(v as Shift)}
              disabled={!canEdit || loading}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="MORNING" id="morning" />
                <Label htmlFor="morning" className="font-normal cursor-pointer">
                  Manhã
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="AFTERNOON" id="afternoon" />
                <Label htmlFor="afternoon" className="font-normal cursor-pointer">
                  Tarde
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="FULL" id="full" />
                <Label htmlFor="full" className="font-normal cursor-pointer">
                  Integral
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="note">Observação</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Observações adicionais..."
              disabled={!canEdit || loading}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          {assignment && canEdit && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              Excluir
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          {canEdit && (
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
