// Apague todo o conteúdo do seu componente Dashboard e substitua por este para o teste:

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";

export default function Dashboard() {

  // 1. Um array de eventos estático, ignorando completamente o Supabase.
  const testEvents = [
    {
      id: 'a',
      title: 'EVENTO DE TESTE VISÍVEL',
      start: '2025-10-09', // A mesma data que vem do seu backend
      allDay: true,
      backgroundColor: 'red', // Força uma cor chamativa
      borderColor: 'red'
    }
  ];

  // 2. Um JSX super simplificado, sem nenhum dos seus componentes ou estilos.
  return (
    <div style={{ padding: '20px' }}>
      <h1>Página de Teste do Calendário</h1>
      <p>
        Se um evento vermelho chamado "EVENTO DE TESTE VISÍVEL" aparecer no dia 9 de outubro abaixo, 
        o problema está em algum lugar na sua implementação original (CSS, wrappers, etc).
      </p>
      
      <div id="calendar-wrapper" style={{ border: '2px solid blue', marginTop: '20px' }}>
        <FullCalendar
          plugins={[dayGridPlugin]}
          initialView="dayGridMonth"
          initialDate={'2025-10-01'} // Força o calendário a iniciar em Outubro de 2025
          weekends={true}
          events={testEvents}     // Usa o array de teste estático
        />
      </div>
    </div>
  );
}
