import { createContext, useContext, useState, type ReactNode } from 'react';

interface BookingState {
  barberId: string | null;
  serviceIds: string[];  // Multi-service
  date: Date | null;
  time: string | null;
}

interface BookingContextType {
  booking: BookingState;
  updateBooking: (updates: Partial<BookingState>) => void;
  toggleService: (id: string) => void;
  clearBooking: () => void;
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export const BookingProvider = ({ children }: { children: ReactNode }) => {
  const [booking, setBooking] = useState<BookingState>({
    barberId: null,
    serviceIds: [],
    date: null,
    time: null
  });

  const updateBooking = (updates: Partial<BookingState>) => {
    setBooking(prev => ({ ...prev, ...updates }));
  };

  const toggleService = (id: string) => {
    setBooking(prev => {
      const has = prev.serviceIds.includes(id);
      return {
        ...prev,
        serviceIds: has
          ? prev.serviceIds.filter(s => s !== id)
          : [...prev.serviceIds, id]
      };
    });
  };

  const clearBooking = () => {
    setBooking({ barberId: null, serviceIds: [], date: null, time: null });
  };

  return (
    <BookingContext.Provider value={{ booking, updateBooking, toggleService, clearBooking }}>
      {children}
    </BookingContext.Provider>
  );
};

export const useBooking = () => {
  const context = useContext(BookingContext);
  if (!context) throw new Error('useBooking must be used within BookingProvider');
  return context;
};
