import React, { createContext, useContext, useState } from "react";

interface FilterContextValue {
  selectedAuthorId: string | undefined;
  setSelectedAuthorId: (id: string | undefined) => void;
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [selectedAuthorId, setSelectedAuthorId] = useState<string | undefined>(undefined);

  return (
    <FilterContext.Provider value={{ selectedAuthorId, setSelectedAuthorId }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter(): FilterContextValue {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilter must be used within FilterProvider");
  return ctx;
}
