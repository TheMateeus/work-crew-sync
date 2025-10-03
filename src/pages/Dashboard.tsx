import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptLocale from "@fullcalendar/core/locales/pt";
import type { EventClickArg, EventDropArg, DatesSetArg } from "@fullcalendar/core";
import type { DateClickArg } from "@fullcalendar/interaction";

// No CSS imports needed - FullCalendar v6 injects styles automatically
import AssignmentModal from "@/components/AssignmentModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Assignment {
  id: string;
  date: string;
  shift: string;
  note: string | null;
  worksite_id: string;
  pair_id: string;
  worksite: {
    id: string;
    name: string;
  };
  pair: {
    id: string;
    label: string;
    members: {
      employee: {
        name: string;
      };
    }[];
  };
}

interface Worksite {
  id: string;
  name: string;
}

interface Pair {
  id: string;
  label: string;
}

// Gerar cor determinística por ID da obra
function getWorksiteColor(worksiteId: string): string {
  const hash = worksiteId.split("").reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);
  
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 50%)`;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const calendarRef = useRef<FullCalendar>(null);
  
  const [currentTitle, setCurrentTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  
  const [worksites, setWorksites] = useState<Worksite[]>([]);
  const [pairs, setPairs] = useState<Pair[]>([]);
  
  const [filterWorksite, setFilterWorksite] = useState<string>("all");
  const [filterPair, setFilterPair] = useState<string>("all");
  const [filterShift, setFilterShift] = useState<string>("all");

  const canEdit = profile?.role === "ADMIN" || profile?.role === "MANAGER";

  useEffect(() => {
    fetchFilters();
  }, []);

  const fetchFilters = async () => {
    const [wsResult, pairResult] = await Promise.all([
      supabase.from("worksites").select("id, name").order("name"),
      supabase.from("pairs").select("id, label").order("label"),
    ]);

    if (wsResult.data) setWorksites(wsResult.data);
    if (pairResult.data) setPairs(pairResult.data);
  };

  const fetchEvents = async (fetchInfo: any, successCallback: any, failureCallback: any) => {
    try {
      setLoading(true);
      const { start, end } = fetchInfo;
      
      const startStr = start.toISOString().split("T")[0];
      const endStr = end.toISOString().split("T")[0];

      let query = supabase
        .from("assignments")
        .select(`
          id, date, shift, note, worksite_id, pair_id,
          worksite:worksites(id, name),
          pair:pairs(id, label, members:pair_members(employee:employees(name)))
        `)
        .gte("date", startStr)
        .lte("date", endStr);

      if (filterWorksite !== "all") {
        query = query.eq("worksite_id", filterWorksite);
      }
      if (filterPair !== "all") {
        query = query.eq("pair_id", filterPair);
      }
      if (filterShift !== "all") {
        query = query.eq("shift", filterShift as Database["public"]["Enums"]["shift"]);
      }

      const { data, error } = await query;

      if (error) throw error;

      const events = (data || []).map((assignment: Assignment) => {
        const color = getWorksiteColor(assignment.worksite.id);
        const members = assignment.pair.members
          .map((m) => m.employee.name)
          .filter(Boolean);

        const eventObj = {
          id: assignment.id,
          start: assignment.date,
          allDay: true,
          title: `${assignment.worksite.name} • ${assignment.pair.label}`,
          backgroundColor: color,
          borderColor: color,
          extendedProps: {
            shift: assignment.shift,
            note: assignment.note,
            worksiteId: assignment.worksite.id,
            pairId: assignment.pair.id,
            worksiteName: assignment.worksite.name,
            pairLabel: assignment.pair.label,
            members,
            rawAssignment: assignment,
          },
        };

        // Log para debug
        console.log('Event created:', eventObj);

        return eventObj;
      });

      successCallback(events);
    } catch (error: any) {
      toast.error("Erro ao carregar escalas: " + error.message);
      failureCallback(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateClick = (info: DateClickArg) => {
    if (!canEdit) return;
    setSelectedAssignment(null);
    setSelectedDate(info.dateStr);
    setModalOpen(true);
  };

  const handleEventClick = (info: EventClickArg) => {
    const assignment = info.event.extendedProps.rawAssignment as Assignment;
    setSelectedAssignment(assignment);
    setSelectedDate("");
    setModalOpen(true);
  };

  const handleEventDrop = async (info: EventDropArg) => {
    if (!canEdit) {
      info.revert();
      return;
    }

    const newDate = info.event.startStr;
    const id = info.event.id;

    const { error } = await supabase
      .from("assignments")
      .update({ date: newDate })
      .eq("id", id);

    if (error) {
      info.revert();
      if (error.message.includes("duplicate") || error.message.includes("unique")) {
        toast.error("Conflito: já existe escala para esta dupla/obra/turno neste dia");
      } else {
        toast.error("Erro ao mover escala: " + error.message);
      }
    } else {
      toast.success("Escala movida com sucesso");
      refetchEvents();
    }
  };

  const handleDatesSet = (arg: DatesSetArg) => {
    setCurrentTitle(arg.view.title);
  };

  const refetchEvents = () => {
    calendarRef.current?.getApi().refetchEvents();
  };

  const handlePrevMonth = () => {
    calendarRef.current?.getApi().prev();
  };

  const handleNextMonth = () => {
    calendarRef.current?.getApi().next();
  };

  const handleToday = () => {
    calendarRef.current?.getApi().today();
  };

  const renderEventContent = (arg: any) => {
    const { shift, worksiteName, pairLabel, members, note } = arg.event.extendedProps;
    
    const shiftLabels: Record<string, string> = {
      MORNING: "Manhã",
      AFTERNOON: "Tarde",
      FULL: "Integral",
    };

    const shiftLabel = shiftLabels[shift] || shift;

    // Log para debug
    console.log('Rendering event:', { worksiteName, pairLabel, shift, shiftLabel });

    return (
      <div className="fc-event-main-frame" style={{ padding: '2px 4px' }}>
        <div style={{ 
          display: 'inline-block',
          padding: '2px 6px',
          marginBottom: '2px',
          borderRadius: '3px',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          color: '#1e293b',
          fontSize: '10px',
          fontWeight: 600
        }}>
          {shiftLabel}
        </div>
        <div style={{ 
          fontSize: '12px', 
          fontWeight: 600,
          color: '#ffffff',
          marginBottom: '1px',
          textShadow: '0 1px 2px rgba(0,0,0,0.3)'
        }}>
          {worksiteName}
        </div>
        <div style={{ 
          fontSize: '11px',
          color: '#ffffff',
          opacity: 0.95,
          textShadow: '0 1px 2px rgba(0,0,0,0.3)'
        }}>
          {pairLabel}
        </div>
        {members && members.length > 0 && (
          <div style={{ 
            fontSize: '10px',
            color: '#ffffff',
            opacity: 0.85,
            marginTop: '1px',
            textShadow: '0 1px 2px rgba(0,0,0,0.3)'
          }}>
            {members.join(", ")}
          </div>
        )}
        {note && (
          <div style={{ 
            fontSize: '10px',
            color: '#ffffff',
            opacity: 0.8,
            fontStyle: 'italic',
            marginTop: '1px',
            textShadow: '0 1px 2px rgba(0,0,0,0.3)'
          }}>
            {note}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendário de Escalas</h1>
          <p className="text-muted-foreground">
            Visualize e gerencie as escalas de trabalho
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => { setSelectedAssignment(null); setSelectedDate(""); setModalOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Escala
          </Button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-card p-4 rounded-lg border">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleToday}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold ml-2">{currentTitle}</h2>
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={filterWorksite} onValueChange={(v) => { setFilterWorksite(v); refetchEvents(); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Todas as obras" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as obras</SelectItem>
              {worksites.map((ws) => (
                <SelectItem key={ws.id} value={ws.id}>
                  {ws.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterPair} onValueChange={(v) => { setFilterPair(v); refetchEvents(); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Todas as duplas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as duplas</SelectItem>
              {pairs.map((pair) => (
                <SelectItem key={pair.id} value={pair.id}>
                  {pair.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterShift} onValueChange={(v) => { setFilterShift(v); refetchEvents(); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Todos turnos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos turnos</SelectItem>
              <SelectItem value="MORNING">Manhã</SelectItem>
              <SelectItem value="AFTERNOON">Tarde</SelectItem>
              <SelectItem value="FULL">Integral</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-card rounded-lg border p-4">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale={ptLocale}
          firstDay={1}
          contentHeight="auto"
          headerToolbar={false}
          editable={canEdit}
          selectable={canEdit}
          selectMirror={true}
          dayMaxEvents={4}
          weekends={true}
          events={fetchEvents}
          eventContent={renderEventContent}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          datesSet={handleDatesSet}
          eventClassNames="shadow-sm"
          dayCellClassNames="hover:bg-accent/50 transition-colors"
        />
      </div>

      <AssignmentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={refetchEvents}
        assignment={selectedAssignment}
        initialDate={selectedDate}
        canEdit={canEdit}
      />
    </div>
  );
}
