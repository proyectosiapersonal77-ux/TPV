import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

const CurrentTime: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(time);

  const formattedDate = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(time);

  return (
    <div className="flex flex-col items-center text-brand-100">
      <div className="text-6xl font-bold tracking-tight font-mono mb-2 drop-shadow-lg flex items-center gap-3">
         {formattedTime}
      </div>
      <div className="text-sm uppercase tracking-widest opacity-80 font-medium">
        {formattedDate}
      </div>
    </div>
  );
};

export default CurrentTime;