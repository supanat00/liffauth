"use client";
import { createContext, useContext, useState, ReactNode } from "react";

interface UserProfile {
    displayName: string;
    userId: string;
}

interface UserContextType {
    user: UserProfile | null;
    setUser: (user: UserProfile) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<UserProfile | null>(null);

    return (
        <UserContext.Provider value={{ user, setUser }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error("useUser must be used within a UserProvider");
    }
    return context;
};