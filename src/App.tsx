import React, { useState, useEffect, useMemo } from 'react';
import { Search, User, BookOpen, CheckCircle, BarChart3, Users, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import Swal from 'sweetalert2';

interface StudentData {
  id: string;
  name: string;
  section: string;
  totalScore: number;
  attendanceScore: number;
  assignmentScore: number;
}

const parseCSV = (csv: string): StudentData[] => {
  const lines = csv.trim().split('\n');
  const dataLines = lines.slice(1); // Skip header
  return dataLines.map((line) => {
    // Remove quotes that Google Sheets might add to CSV fields
    const cleanLine = line.replace(/"/g, '');
    const [id, name, section, total, attendance, assignment] = cleanLine.split(',');
    return {
      id: id?.trim() || '',
      name: name?.trim() || '',
      section: section?.trim() || '',
      totalScore: parseFloat(total) || 0,
      attendanceScore: parseFloat(attendance) || 0,
      assignmentScore: parseFloat(assignment) || 0,
    };
  }).filter(s => s.id !== ''); // Filter out empty lines
};

// --- Zen Minimalist Components ---

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-[var(--color-zen-card)] rounded-2xl shadow-sm border border-[var(--color-zen-border)] p-6 transition-all duration-300 hover:shadow-md ${className}`}>
    {children}
  </div>
);

const StatBox = ({ title, value, max, icon: Icon, colorClass, barColorClass }: any) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="p-5 rounded-2xl bg-[var(--color-zen-bg)] bg-opacity-50 border border-[var(--color-zen-border)] flex flex-col justify-between">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-2">
          <div className={`p-1.5 rounded-full ${colorClass} bg-opacity-10 shrink-0`}>
            <Icon className={`w-4 h-4 ${colorClass.replace('bg-', 'text-')}`} />
          </div>
          <p className="text-xs font-medium text-gray-600 whitespace-nowrap">{title}</p>
        </div>
        <div className="flex items-baseline space-x-1 whitespace-nowrap">
          <span className="text-xl font-bold text-[var(--color-zen-text)]">{value.toFixed(2)}</span>
          <span className="text-xs font-bold text-gray-400">/ {max}</span>
        </div>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full ${barColorClass} transition-all duration-1000 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default function App() {
  const [studentsData, setStudentsData] = useState<StudentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [searchedId, setSearchedId] = useState('');

  // Derived state: Automatically updates when studentsData changes (Live Update)
  const foundStudent = useMemo(() => {
    if (!searchedId) return null;
    return studentsData.find(s => s.id === searchedId) || null;
  }, [studentsData, searchedId]);

  // Fetch data from Google Sheets
  const fetchSheetData = async (isInitial = false) => {
    if (isInitial) setIsLoading(true);
    else setIsSyncing(true);
    
    try {
      const sheetId = '1BhhOzg8ZaK3RaCzRl6iDKtMftYLH8f7iAwio-7QiRLI';
      // Using Google Visualization API endpoint to get CSV with cache buster
      const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&_=${Date.now()}`;
      
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error('Network response was not ok');
      
      const csvText = await response.text();
      
      // If the sheet is private, Google redirects to a login page returning HTML
      if (csvText.trim().toLowerCase().startsWith('<!doctype html>') || csvText.trim().toLowerCase().startsWith('<html')) {
        throw new Error('Sheet is private');
      }

      const parsedData = parseCSV(csvText);
      setStudentsData(parsedData);
      setLastUpdated(new Date());
      setError('');
    } catch (err) {
      console.error("Error fetching data:", err);
      if (isInitial) {
        setError('ไม่สามารถดึงข้อมูลได้ โปรดตรวจสอบว่า Google Sheet เปิดสิทธิ์เป็น "ทุกคนที่มีลิงก์สามารถดูได้" (Anyone with the link)');
      }
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  };

  // Initial load and polling setup
  useEffect(() => {
    fetchSheetData(true);
    // Poll every 10 seconds for live updates
    const intervalId = setInterval(() => {
      fetchSheetData(false);
    }, 10000);

    return () => clearInterval(intervalId);
  }, []);

  // --- Overview Data Calculations ---
  const overviewStats = useMemo(() => {
    if (studentsData.length === 0) return null;

    const totalStudents = studentsData.length;
    const avgTotal = studentsData.reduce((acc, curr) => acc + curr.totalScore, 0) / totalStudents;
    const avgAttendance = studentsData.reduce((acc, curr) => acc + curr.attendanceScore, 0) / totalStudents;
    const avgAssignment = studentsData.reduce((acc, curr) => acc + curr.assignmentScore, 0) / totalStudents;

    const chartData = [
      { name: 'คะแนนรวม', average: parseFloat(avgTotal.toFixed(2)), max: 50 },
      { name: 'คะแนนเข้าห้อง', average: parseFloat(avgAttendance.toFixed(2)), max: 10 },
      { name: 'คะแนนงานเดี่ยว', average: parseFloat(avgAssignment.toFixed(2)), max: 40 },
    ];

    return { totalStudents, avgTotal, avgAttendance, avgAssignment, chartData };
  }, [studentsData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchTerm.trim();
    if (!term) return;

    const student = studentsData.find((s) => s.id === term);
    if (student) {
      setSearchedId(term);
    } else {
      setSearchedId('');
      Swal.fire({
        title: 'ไม่พบข้อมูล',
        text: 'ไม่พบข้อมูลนักเรียนในระบบ ขอให้คุณกรอกรหัสนักศึกษาให้ถูกต้อง',
        icon: 'warning',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#8A9A5B', // Matcha Green
        background: '#F7F5F0',
        color: '#4A4A4A',
        customClass: {
          popup: 'rounded-2xl',
        }
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-zen-bg)] text-[var(--color-zen-text)] font-sans">
        <Loader2 className="w-12 h-12 animate-spin text-[var(--color-zen-matcha)] mb-4" />
        <p className="text-lg font-medium tracking-wide">กำลังโหลดข้อมูลจาก Google Sheet...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-zen-bg)] text-[var(--color-zen-text)] font-sans p-6 text-center">
        <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
        <h2 className="text-2xl font-medium mb-2">เกิดข้อผิดพลาด</h2>
        <p className="text-gray-600 max-w-md">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-12">
        
        {/* Header Section */}
        <header className="text-center space-y-4">
          <h1 className="text-3xl md:text-4xl font-medium text-[var(--color-zen-text)] tracking-wide">
            ระบบการเช็คคะแนนเก็บวิชา
          </h1>
          <h2 className="text-xl md:text-2xl font-light text-[var(--color-zen-wood)]">
            “CDE118 คลาสออแอ็ค”
          </h2>
          <div className="w-24 h-1 bg-[var(--color-zen-matcha)] mx-auto rounded-full mt-6 opacity-60"></div>
          
          {/* Live Update Indicator */}
          <div className="flex items-center justify-center space-x-2 mt-4 text-sm text-gray-500">
            {isSyncing ? (
              <RefreshCw className="w-4 h-4 animate-spin text-[var(--color-zen-matcha)]" />
            ) : (
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            )}
            <span>
              {isSyncing 
                ? 'กำลังซิงค์ข้อมูล...' 
                : `อัปเดตล่าสุด: ${lastUpdated?.toLocaleTimeString('th-TH')}`}
            </span>
          </div>
        </header>

        {/* Search Section */}
        <section className="max-w-xl mx-auto">
          <form onSubmit={handleSearch} className="relative flex items-center">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-11 pr-32 py-4 bg-white border border-[var(--color-zen-border)] rounded-full text-[var(--color-zen-text)] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-zen-matcha)] focus:border-transparent transition-shadow shadow-sm"
              placeholder="กรอกรหัสนักศึกษา (เช่น 1-67-03-0630-5)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button
              type="submit"
              className="absolute right-2 top-2 bottom-2 px-6 bg-[var(--color-zen-matcha)] text-white rounded-full hover:bg-opacity-90 transition-colors font-medium tracking-wide focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-zen-matcha)]"
            >
              ค้นหา
            </button>
          </form>
        </section>

        {/* Individual Dashboard (Conditional) */}
        {foundStudent && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-xl font-medium mb-6 flex items-center text-[var(--color-zen-text)]">
              <User className="mr-2 w-5 h-5 text-[var(--color-zen-wood)]" />
              ข้อมูลนักศึกษา
            </h3>
            <Card className="border-l-4 border-l-[var(--color-zen-matcha)]">
              <div className="space-y-8">
                {/* Top Section: Student Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-6 border-b border-[var(--color-zen-border)] border-dashed">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1 whitespace-nowrap">ชื่อ-นามสกุล</p>
                    <p className="text-xl font-bold text-[var(--color-zen-text)] truncate">{foundStudent.name}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1 whitespace-nowrap">รหัสนักศึกษา</p>
                    <p className="text-xl font-bold text-[var(--color-zen-text)] whitespace-nowrap">{foundStudent.id}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1 whitespace-nowrap">Section</p>
                    <p className="text-xl font-bold text-[var(--color-zen-text)] whitespace-nowrap">{foundStudent.section}</p>
                  </div>
                </div>
                
                {/* Bottom Section: Scores in 3 Columns */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <StatBox 
                    title="คะแนนรวม" 
                    value={foundStudent.totalScore} 
                    max={50} 
                    icon={BarChart3} 
                    colorClass="bg-[#8A9A5B] text-[#8A9A5B]" 
                    barColorClass="bg-[#8A9A5B]"
                  />
                  <StatBox 
                    title="คะแนนเข้าห้อง" 
                    value={foundStudent.attendanceScore} 
                    max={10} 
                    icon={CheckCircle} 
                    colorClass="bg-[#A67B5B] text-[#A67B5B]" 
                    barColorClass="bg-[#A67B5B]"
                  />
                  <StatBox 
                    title="คะแนนงานเดี่ยว" 
                    value={foundStudent.assignmentScore} 
                    max={40} 
                    icon={BookOpen} 
                    colorClass="bg-[#8C9A9E] text-[#8C9A9E]" 
                    barColorClass="bg-[#8C9A9E]"
                  />
                </div>
              </div>
            </Card>
          </section>
        )}

        {/* Overview Dashboard */}
        {overviewStats && (
          <section className="pt-8 border-t border-[var(--color-zen-border)]">
            <h3 className="text-xl font-medium mb-6 flex items-center text-[var(--color-zen-text)]">
              <Users className="mr-2 w-5 h-5 text-[var(--color-zen-wood)]" />
              ภาพรวมคะแนนทั้งหมด (นักศึกษา {overviewStats.totalStudents} คน)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
              {/* Average Stats Progress Bars */}
              <Card className="flex flex-col">
                <h4 className="text-lg font-medium text-[var(--color-zen-text)] mb-8">คะแนนเฉลี่ยรวม</h4>
                
                <div className="flex-1 flex flex-col justify-center space-y-8">
                  <div className="space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="text-sm font-medium text-gray-600">คะแนนรวมทั้งหมด</span>
                      <div className="flex items-baseline space-x-1">
                        <span className="text-3xl font-bold text-[var(--color-zen-matcha)]">{overviewStats.avgTotal.toFixed(2)}</span>
                        <span className="text-sm font-bold text-gray-400">/ 50</span>
                      </div>
                    </div>
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-[var(--color-zen-matcha)] transition-all duration-1000 ease-out"
                        style={{ width: `${(overviewStats.avgTotal / 50) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="text-sm font-medium text-gray-600">คะแนนเข้าห้อง</span>
                      <div className="flex items-baseline space-x-1">
                        <span className="text-2xl font-bold text-[var(--color-zen-wood)]">{overviewStats.avgAttendance.toFixed(2)}</span>
                        <span className="text-sm font-bold text-gray-400">/ 10</span>
                      </div>
                    </div>
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-[var(--color-zen-wood)] transition-all duration-1000 ease-out"
                        style={{ width: `${(overviewStats.avgAttendance / 10) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="text-sm font-medium text-gray-600">คะแนนงานเดี่ยว</span>
                      <div className="flex items-baseline space-x-1">
                        <span className="text-2xl font-bold text-[#8C9A9E]">{overviewStats.avgAssignment.toFixed(2)}</span>
                        <span className="text-sm font-bold text-gray-400">/ 40</span>
                      </div>
                    </div>
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-[#8C9A9E] transition-all duration-1000 ease-out"
                        style={{ width: `${(overviewStats.avgAssignment / 40) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Card>

              {/* Summary Card */}
              <Card className="flex flex-col">
                <h4 className="text-lg font-medium text-[var(--color-zen-text)] mb-8">สรุปภาพรวม</h4>
                
                <div className="flex-1 flex flex-col justify-between">
                  <div className="bg-[var(--color-zen-bg)] p-6 rounded-2xl border border-[var(--color-zen-border)] mb-8">
                    <p className="text-base text-gray-600 leading-relaxed">
                      จากนักศึกษาทั้งหมด <span className="font-bold text-[var(--color-zen-text)] text-lg">{overviewStats.totalStudents}</span> คน 
                      มีคะแนนเฉลี่ยรวมอยู่ที่ <span className="font-bold text-[var(--color-zen-matcha)] text-lg">{overviewStats.avgTotal.toFixed(2)}</span> คะแนน 
                      คิดเป็น <span className="font-bold text-[var(--color-zen-text)] text-lg">{((overviewStats.avgTotal / 50) * 100).toFixed(1)}%</span> ของคะแนนเต็ม
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-500">ความคืบหน้าคะแนนเฉลี่ยรวม</span>
                      <span className="text-3xl font-bold text-[var(--color-zen-matcha)]">
                        {((overviewStats.avgTotal / 50) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-8 bg-gray-100 rounded-full overflow-hidden p-1.5 shadow-inner">
                      <div 
                        className="h-full rounded-full bg-gradient-to-r from-[var(--color-zen-matcha)] to-[#A4B475] transition-all duration-1000 ease-out shadow-sm"
                        style={{ width: `${(overviewStats.avgTotal / 50) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="pt-12 pb-4 text-center">
          <p className="text-sm text-gray-400 font-light tracking-wide">
            ระบบแสดงเฉพาะคะแนนเก็บ 50 คะแนนเท่านั้น
          </p>
        </footer>
      </div>
    </div>
  );
}
