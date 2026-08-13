import React, { createContext, useState, useContext } from 'react';

export interface EmployeeCredential {
  id: string;
  name: string;
  employeeId: string;
  email: string;
  designation: string;
}

export interface AttendanceLog {
  id: string;
  date: string;       
  dayOfWeek: string;   
  loginTime: string;   
  logoutTime: string;  
}

interface AttendanceContextType {
  logs: AttendanceLog[];
  employees: EmployeeCredential[];
  addPunch: (type: 'LOGIN' | 'LOGOUT') => void;
  addEmployee: (employee: Omit<EmployeeCredential, 'id'>) => void;
}

const AttendanceContext = createContext<AttendanceContextType | undefined>(undefined);

export function AttendanceProvider({ children }: { children: React.ReactNode }) {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  
  // Seed with our default employee profile
  const [employees, setEmployees] = useState<EmployeeCredential[]>([
    {
      id: '1',
      name: 'John Doe',
      employeeId: 'EMP-4021',
      email: 'john.doe@company.com',
      designation: 'Senior Software Engineer'
    }
  ]);

  const addPunch = (type: 'LOGIN' | 'LOGOUT') => {
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const formattedDay = now.toLocaleDateString('en-US', { weekday: 'long' });
    const formattedTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    setLogs((prevLogs) => {
      const todayIndex = prevLogs.findIndex(log => log.date === formattedDate);

      if (todayIndex > -1) {
        const updatedLogs = [...prevLogs];
        if (type === 'LOGIN') {
          updatedLogs[todayIndex].loginTime = formattedTime;
        } else {
          updatedLogs[todayIndex].logoutTime = formattedTime;
        }
        return updatedLogs;
      } else {
        if (type === 'LOGIN') {
          const newDayCard: AttendanceLog = {
            id: Math.random().toString(),
            date: formattedDate,
            dayOfWeek: formattedDay,
            loginTime: formattedTime,
            logoutTime: '--:--',
          };
          return [newDayCard, ...prevLogs];
        }
        return prevLogs;
      }
    });
  };

  const addEmployee = (newEmp: Omit<EmployeeCredential, 'id'>) => {
    const createdItem: EmployeeCredential = {
      ...newEmp,
      id: Math.random().toString(),
    };
    setEmployees((prev) => [createdItem, ...prev]);
  };

  return (
    <AttendanceContext.Provider value={{ logs, employees, addPunch, addEmployee }}>
      {children}
    </AttendanceContext.Provider>
  );
}

export function useAttendance() {
  const context = useContext(AttendanceContext);
  if (!context) throw new Error('useAttendance must be used within an AttendanceProvider');
  return context;
}
