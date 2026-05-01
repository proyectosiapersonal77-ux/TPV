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
    <div className="flex flex-row items-baseline gap-3 text-brand-100">
      <div className="text-3xl sm:text-4xl font-bold tracking-tight font-mono drop-shadow-lg flex items-center">
         <Clock className="w-5 h-5 sm:w-6 sm:h-6 mr-2 opacity-80 hidden sm:inline-block" />
         {formattedTime}
      </div>
      <div className="text-xs sm:text-sm uppercase tracking-widest opacity-80 font-medium">
        {formattedDate}
      </div>
    </div>
  );
};

export default CurrentTime;