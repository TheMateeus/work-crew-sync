import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface Assignment {
  id: string;
  date: string;
  shift: string;
  note: string | null;
  worksite: {
    name: string;
  };
  pair: {
    label: string;
  };
}

export default function Dashboard() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from("assignments")
        .select(`
          *,
          worksite:worksites(name),
          pair:pairs(label)
        `)
        .order("date", { ascending: true })
        .limit(10);

      if (error) throw error;
      setAssignments(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar escalas: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR");
  };

  const formatShift = (shift: string) => {
    const shifts: Record<string, string> = {
      MORNING: "Manhã",
      AFTERNOON: "Tarde",
      FULL: "Integral",
    };
    return shifts[shift] || shift;
  };

  const canEdit = profile?.role === "ADMIN" || profile?.role === "MANAGER";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendário de Escalas</h1>
          <p className="text-muted-foreground">
            Visualize e gerencie as escalas de trabalho
          </p>
        </div>
        {canEdit && (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nova Escala
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando escalas...</p>
          </div>
        </div>
      ) : assignments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">Nenhuma escala cadastrada</p>
            {canEdit && (
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Criar primeira escala
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {assignments.map((assignment) => (
            <Card key={assignment.id}>
              <CardHeader>
                <CardTitle className="text-lg">{assignment.worksite.name}</CardTitle>
                <CardDescription>
                  {formatDate(assignment.date)} - {formatShift(assignment.shift)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center text-sm">
                    <span className="font-medium mr-2">Dupla:</span>
                    <span className="text-muted-foreground">{assignment.pair.label}</span>
                  </div>
                  {assignment.note && (
                    <div className="text-sm">
                      <span className="font-medium">Observação:</span>
                      <p className="text-muted-foreground mt-1">{assignment.note}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
