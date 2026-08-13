import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Alert, Linking, ActivityIndicator, Modal } from 'react-native';
import { useAuth, API_BASE_URL } from './_layout';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

interface EmployeeProfile {
  _id: string;
  name: string;
  employeeId: string;
  designation: string;
  email: string;
  password?: string;
  lunchBreakMinutes?: number;
  role?: string[];
}

interface AttendanceRecord {
  _id: string;
  employeeIdReference: string;
  employeeName: string;
  date: string; 
  dayOfWeek: string;
  loginTime: string;
  logoutTime: string;
}

export default function AdminScreen() {
  const { logout } = useAuth();

  const [activeTab, setActiveTab] = useState<'REGISTER' | 'LOGS'>('REGISTER');
  const [selectedEmpFilter, setSelectedEmpFilter] = useState<string>('ALL');
  
  const currentMonthName = new Date().toLocaleDateString('en-US', { month: 'long' }); 
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>(currentMonthName);

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);

  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // 🔍 SEARCH QUERY STATES
  const [empSearchQuery, setEmpSearchQuery] = useState<string>('');
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');

  const [empName, setEmpName] = useState('');
  const [empIdCode, setEmpIdCode] = useState('');
  const [empDesignation, setEmpDesignation] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empPassword, setEmpPassword] = useState('');
  
  // 🍱 DROPDOWN LUNCH TIMING SELECTION STATES
  const [selectedLunchHours, setSelectedLunchHours] = useState<number>(0);
  const [selectedLunchMins, setSelectedLunchMins] = useState<number>(0);
  const [showHoursDropdown, setShowHoursDropdown] = useState<boolean>(false);
  const [showMinsDropdown, setShowMinsDropdown] = useState<boolean>(false);

  const [showEmpPassword, setShowEmpPassword] = useState<boolean>(false);

  const [adminName, setAdminName] = useState('');
  const [adminIdCode, setAdminIdCode] = useState('');
  const [adminDesignation, setAdminDesignation] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState<boolean>(false);

  const availableMonths = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const hoursList = Array.from({ length: 13 }, (_, i) => i);
  const minutesList = Array.from({ length: 60 }, (_, i) => i);

  // ⏱️ WORKING HOURS CALCULATOR WITH LUNCH DEDUCTION MATCHING
  const calculateWorkingHours = (inTime: string, outTime: string, employeeNameTarget?: string, employeeIdTarget?: string) => {
    if (!inTime || !outTime || inTime === '--:--' || outTime === '--:--' || inTime === 'ABSENT' || outTime === 'ABSENT') {
      return '--';
    }
    try {
      const parseTimeToMinutes = (timeStr: string) => {
        const cleanTime = timeStr.trim().toUpperCase();
        const isPM = cleanTime.includes('PM');
        const isAM = cleanTime.includes('AM');
        
        const timeOnly = cleanTime.replace(/(AM|PM)/g, '').trim();
        const parts = timeOnly.split(/[:\.]/).map(Number);
        
        let hours = parts[0] || 0;
        const minutes = parts[1] || 0;

        if (isPM && hours < 12) hours += 12;
        if (isAM && hours === 12) hours = 0;

        return hours * 60 + minutes;
      };

      const inMins = parseTimeToMinutes(inTime);
      const outMins = parseTimeToMinutes(outTime);

      const grossMinutes = outMins - inMins;
      if (grossMinutes <= 0) return '0h 0m';

      const matchedEmp = employees.find(e => 
        (employeeIdTarget && e.employeeId?.toLowerCase().trim() === employeeIdTarget?.toLowerCase().trim()) ||
        (employeeNameTarget && e.name?.toLowerCase().trim() === employeeNameTarget?.toLowerCase().trim())
      );

      const lunchDeduction = matchedEmp?.lunchBreakMinutes !== undefined 
        ? Number(matchedEmp.lunchBreakMinutes) 
        : 0;

      const netMinutes = grossMinutes >= lunchDeduction ? grossMinutes - lunchDeduction : 0;

      return `${Math.floor(netMinutes / 60)}h ${netMinutes % 60}m`;
    } catch (e) {
      return '--';
    }
  };

  const fetchEmployeesList = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/employees`);
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch (error) {
      console.error('Failed fetching employee array:', error);
    }
  };

  const fetchAttendanceLogs = async (filterName: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/admin/attendance-sheet?employeeName=${filterName}`);
      if (response.ok) {
        const data = await response.json();
        setAttendanceLogs(data);
      }
    } catch (error) {
      Alert.alert('Network Error', 'Could not sync log history from cloud servers.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployeesList();
    if (activeTab === 'LOGS') {
      fetchAttendanceLogs(selectedEmpFilter);
    }
  }, [activeTab, selectedEmpFilter]);

  const getFilteredLogs = () => {
    const currentYearString = new Date().getFullYear().toString();
    return attendanceLogs.filter((log) => {
      if (!log.date) return false;
      const logDateLower = log.date.toLowerCase();
      const matchesMonth = logDateLower.includes(selectedMonthFilter.toLowerCase());
      const matchesYear = logDateLower.includes(currentYearString);
      return matchesMonth && matchesYear;
    });
  };

  const filteredLogs = getFilteredLogs();

  const searchedEmployees = employees.filter((emp) => {
    if (!empSearchQuery.trim()) return true;
    const q = empSearchQuery.toLowerCase().trim();
    return (
      emp.name?.toLowerCase().includes(q) ||
      emp.employeeId?.toLowerCase().includes(q) ||
      emp.designation?.toLowerCase().includes(q) ||
      emp.email?.toLowerCase().includes(q)
    );
  });

  const filteredWorkforceEmployees = employees.filter(e => {
    const r: string[] = Array.isArray(e.role) ? e.role : [e.role || 'EMPLOYEE'];
    if (r.includes('ADMIN_VIEW')) return false;

    if (!logSearchQuery.trim()) return true;
    const q = logSearchQuery.toLowerCase().trim();
    return (
      e.name?.toLowerCase().includes(q) ||
      e.employeeId?.toLowerCase().includes(q)
    );
  });

  const searchedLogs = filteredLogs.filter((log) => {
    if (!logSearchQuery.trim()) return true;
    const q = logSearchQuery.toLowerCase().trim();
    return (
      log.employeeName?.toLowerCase().includes(q) ||
      log.employeeIdReference?.toLowerCase().includes(q) ||
      log.date?.toLowerCase().includes(q) ||
      log.loginTime?.toLowerCase().includes(q) ||
      log.logoutTime?.toLowerCase().includes(q)
    );
  });

  const handleLogSearchChange = (text: string) => {
    setLogSearchQuery(text);
    if (!text.trim()) {
      setSelectedEmpFilter('ALL');
      return;
    }
    const matchingEmp = employees.find(
      (e) => e.name.toLowerCase().trim() === text.toLowerCase().trim()
    );
    if (matchingEmp) {
      setSelectedEmpFilter(matchingEmp.name);
    }
  };

  const handleCreateEmployeeSubmit = async () => {
    if (!empName || !empIdCode || !empDesignation || !empEmail || (!isEditing && !empPassword)) {
      Alert.alert('Missing Fields', 'Please fill out all required fields inside the Employee form.');
      return;
    }

    const calculatedTotalLunchMinutes = Number(selectedLunchHours) * 60 + Number(selectedLunchMins);

    const payload: any = {
      name: empName.trim(),
      employeeId: empIdCode.trim().toUpperCase(),
      designation: empDesignation.trim(),
      email: empEmail.trim().toLowerCase(),
      lunchBreakMinutes: calculatedTotalLunchMinutes,
      role: 'EMPLOYEE'
    };

    if (empPassword) {
      payload.password = empPassword;
    }

    executeServerProvisioning(payload, empName.trim());
  };

  const handleCreateAdminViewSubmit = async () => {
    if (!adminName || !adminIdCode || !adminDesignation || !adminEmail || (!isEditing && !adminPassword)) {
      Alert.alert('Missing Fields', 'Please fill out all fields inside the Admin View Supervisor form.');
      return;
    }

    const payload: any = {
      name: adminName.trim(),
      employeeId: adminIdCode.trim().toUpperCase(),
      designation: adminDesignation.trim(),
      email: adminEmail.trim().toLowerCase(),
      role: 'ADMIN_VIEW'
    };

    if (adminPassword) {
      payload.password = adminPassword;
    }

    executeServerProvisioning(payload, adminName.trim());
  };

  const executeServerProvisioning = async (payload: any, targetedName: string) => {
    try {
      setIsLoading(true);
      let response;

      if (isEditing && editingTargetId) {
        response = await fetch(`${API_BASE_URL}/admin/update-employee`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ _id: editingTargetId, ...payload })
        });
      } else {
        response = await fetch(`${API_BASE_URL}/admin/register-employee`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const result = await response.json();

      if (response.ok && (result.success || result._id || result.employee)) {
        Alert.alert('Success 🎉', isEditing ? 'Account profile updated.' : `Credentials deployed for ${targetedName}.`);
        clearAllFormStates();
        fetchEmployeesList();
      } else {
        Alert.alert('Operation Denied', result.message || 'Error processing account data.');
      }
    } catch (error) {
      Alert.alert('Connection Error', 'Failed to communicate with database server.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectEditEmployee = (item: EmployeeProfile) => {
    clearAllFormStates();
    setIsEditing(true);
    setEditingTargetId(item._id);

    const roles: string[] = Array.isArray(item.role) ? item.role : [item.role || 'EMPLOYEE'];

    if (roles.includes('ADMIN_VIEW')) {
      setAdminName(item.name);
      setAdminIdCode(item.employeeId);
      setAdminDesignation(item.designation);
      setAdminEmail(item.email);
      setAdminPassword(item.password || '');
    } else {
      setEmpName(item.name);
      setEmpIdCode(item.employeeId);
      setEmpDesignation(item.designation);
      setEmpEmail(item.email);
      setEmpPassword(item.password || '');
      
      const totalMins = item.lunchBreakMinutes !== undefined ? Number(item.lunchBreakMinutes) : 0;
      setSelectedLunchHours(Math.floor(totalMins / 60));
      setSelectedLunchMins(totalMins % 60);
    }
  };

  const handleDeleteTrigger = (id: string, nameString: string) => {
    Alert.alert(
      'Purge Confirmation ⚠️',
      `Are you sure you want to permanently delete ${nameString}? All associated log entries will be wiped.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/admin/delete-employee/${id}`, { method: 'DELETE' });
              if (response.ok) {
                Alert.alert('Deleted Successfully', 'Profile entry swept from database cluster.');
                clearAllFormStates();
                fetchEmployeesList();
              }
            } catch (err) {
              Alert.alert('System Error', 'Failed to process termination sequence.');
            }
          }
        }
      ]
    );
  };

  const clearAllFormStates = () => {
    setIsEditing(false);
    setEditingTargetId(null);
    setEmpName(''); setEmpIdCode(''); setEmpDesignation(''); setEmpEmail(''); setEmpPassword(''); 
    setSelectedLunchHours(0); setSelectedLunchMins(0); 
    setShowEmpPassword(false);
    setAdminName(''); setAdminIdCode(''); setAdminDesignation(''); setAdminEmail(''); setAdminPassword('');
    setShowAdminPassword(false);
  };

  const handleDownloadReport = () => {
    const currentYearString = new Date().getFullYear().toString();
    const downloadUrl = `${API_BASE_URL}/admin/download-attendance?employeeName=${selectedEmpFilter}&month=${selectedMonthFilter}&year=${currentYearString}&includeWorkingHours=true`;
    Linking.openURL(downloadUrl).catch(() => {
      Alert.alert('Download Error', 'Could not connect to spreadsheet download engine.');
    });
  };

  return (
    <View style={styles.container}>
      {/* BANNER HEADER */}
      <View style={styles.headerHeroCard}>
        <View style={styles.headerInfoBlock}>
          <Text style={styles.headerSubtitle}>MASTER MANAGEMENT HUB</Text>
          <Text style={styles.headerTitle}>System Administrator</Text>
        </View>
        <TouchableOpacity style={styles.exitBadgeBtn} activeOpacity={0.7} onPress={() => logout()}>
          <Ionicons name="log-out-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.exitBtnText}>Exit Panel</Text>
        </TouchableOpacity>
      </View>

      {/* METRIC BADGES */}
      <View style={styles.summaryGridContainer}>
        <View style={[styles.statBoxSummary, { borderLeftColor: '#007AFF' }]}>
          <Text style={styles.statBoxNumber}>
            {employees.filter(e => {
              const r: string[] = Array.isArray(e.role) ? e.role : [e.role || 'EMPLOYEE'];
              return !r.includes('ADMIN_VIEW');
            }).length}
          </Text>
          <Text style={styles.statBoxLabel}>Total Staff Profiles</Text>
        </View>
        <View style={[styles.statBoxSummary, { borderLeftColor: '#805AD5' }]}>
          <Text style={styles.statBoxNumber}>
            {employees.filter(e => {
              const r: string[] = Array.isArray(e.role) ? e.role : [e.role || 'EMPLOYEE'];
              return r.includes('ADMIN_VIEW');
            }).length}
          </Text>
          <Text style={styles.statBoxLabel}>Admin View Supervisors</Text>
        </View>
      </View>

      {/* STRIP TABS */}
      <View style={styles.menuToggleRow}>
        <TouchableOpacity style={[styles.menuTab, activeTab === 'REGISTER' && styles.activeMenuTab]} onPress={() => { setActiveTab('REGISTER'); clearAllFormStates(); }}>
          <Ionicons name="person-add-outline" size={14} color={activeTab === 'REGISTER' ? '#007AFF' : '#718096'} style={{ marginRight: 6 }} />
          <Text style={[styles.menuTabText, activeTab === 'REGISTER' && styles.activeMenuTabText]}>Provisioning Workspace</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.menuTab, activeTab === 'LOGS' && styles.activeMenuTab]} onPress={() => setActiveTab('LOGS')}>
          <Ionicons name="newspaper-outline" size={14} color={activeTab === 'LOGS' ? '#007AFF' : '#718096'} style={{ marginRight: 6 }} />
          <Text style={[styles.menuTabText, activeTab === 'LOGS' && styles.activeMenuTabText]}>Master Logs Sheet</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'REGISTER' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          
          {/* 👤 FORM 1: STANDARD EMPLOYEE */}
          {(!isEditing || (isEditing && !employees.find(e => e._id === editingTargetId)?.role?.includes('ADMIN_VIEW'))) && (
            <View style={styles.formCard}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="id-card-outline" size={16} color="#007AFF" />
                <Text style={styles.sectionHeading}>
                  {isEditing ? 'Modify Employee Account Details' : 'Form 1: Register Standard Employee'}
                </Text>
              </View>
              
              <Text style={styles.inputLabel}>Employee Full Name</Text>
              <TextInput style={styles.input} value={empName} onChangeText={setEmpName} placeholder="e.g. John Doe" placeholderTextColor="#A0AEC0" />

              <View style={styles.inlineInputsRow}>
                <View style={{ width: '48%' }}>
                  <Text style={styles.inputLabel}>Employee ID Code</Text>
                  <TextInput style={styles.input} value={empIdCode} onChangeText={setEmpIdCode} placeholder="EMP-204" placeholderTextColor="#A0AEC0" autoCapitalize="characters" editable={!isEditing} />
                </View>
                <View style={{ width: '48%' }}>
                  <Text style={styles.inputLabel}>Designation / Role</Text>
                  <TextInput style={styles.input} value={empDesignation} onChangeText={setEmpDesignation} placeholder="Software Engineer" placeholderTextColor="#A0AEC0" />
                </View>
              </View>

              <Text style={styles.inputLabel}>Official Email Address</Text>
              <TextInput style={styles.input} value={empEmail} onChangeText={setEmpEmail} placeholder="worker@medini.com" placeholderTextColor="#A0AEC0" keyboardType="email-address" autoCapitalize="none" />

              {/* 🍱 DROPDOWN LUNCH BREAK SELECTION */}
              <Text style={styles.inputLabel}>Set Fixed Lunch Break Duration</Text>
              <View style={styles.dropdownPickerRow}>
                
                <View style={{ width: '48%' }}>
                  <Text style={styles.subInputLabel}>Hours (0 - 12)</Text>
                  <TouchableOpacity 
                    style={styles.dropdownTriggerBtn} 
                    onPress={() => setShowHoursDropdown(true)}
                  >
                    <Text style={styles.dropdownValueText}>{selectedLunchHours} {selectedLunchHours === 1 ? 'Hour' : 'Hours'}</Text>
                    <Ionicons name="chevron-down" size={16} color="#718096" />
                  </TouchableOpacity>
                </View>

                <View style={{ width: '48%' }}>
                  <Text style={styles.subInputLabel}>Minutes (0 - 59)</Text>
                  <TouchableOpacity 
                    style={styles.dropdownTriggerBtn} 
                    onPress={() => setShowMinsDropdown(true)}
                  >
                    <Text style={styles.dropdownValueText}>{selectedLunchMins} Mins</Text>
                    <Ionicons name="chevron-down" size={16} color="#718096" />
                  </TouchableOpacity>
                </View>

              </View>

              <Text style={styles.lunchSummaryNote}>
                Total Deduction: {selectedLunchHours > 0 ? `${selectedLunchHours}h ` : ''}{selectedLunchMins}m per shift
              </Text>

              <Text style={styles.inputLabel}>Access Password {isEditing ? '(Optional)' : ''}</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={empPassword}
                  onChangeText={setEmpPassword}
                  placeholder={isEditing ? 'Leave blank to keep unchanged' : '••••••••'}
                  placeholderTextColor="#A0AEC0"
                  secureTextEntry={!showEmpPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.eyeIconBtn}
                  onPress={() => setShowEmpPassword(!showEmpPassword)}
                >
                  <Ionicons
                    name={showEmpPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#718096"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.formActionBtnGroup}>
                <TouchableOpacity style={[styles.submitButton, { flex: 1 }]} onPress={handleCreateEmployeeSubmit}>
                  <Ionicons name="rocket-outline" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.submitButtonText}>{isEditing ? 'Save Employee Changes' : 'Deploy Employee Credentials'}</Text>
                </TouchableOpacity>
                {isEditing && (
                  <TouchableOpacity style={styles.cancelEditBtn} onPress={clearAllFormStates}>
                    <Text style={styles.cancelEditBtnText}>Cancel</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* 👁️ FORM 2: ADMIN VIEW SUPERVISOR */}
          {(!isEditing || (isEditing && employees.find(e => e._id === editingTargetId)?.role?.includes('ADMIN_VIEW'))) && (
            <View style={[styles.formCard, { borderTopColor: '#805AD5', borderTopWidth: 4 }]}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="eye-outline" size={16} color="#805AD5" />
                <Text style={[styles.sectionHeading, { color: '#805AD5' }]}>
                  {isEditing ? 'Modify Admin View Account Details' : 'Form 2: Register Admin View Supervisor'}
                </Text>
              </View>
              
              <Text style={styles.inputLabel}>Supervisor Full Name</Text>
              <TextInput style={styles.input} value={adminName} onChangeText={setAdminName} placeholder="e.g. Sarah Connor" placeholderTextColor="#A0AEC0" />

              <View style={styles.inlineInputsRow}>
                <View style={{ width: '48%' }}>
                  <Text style={styles.inputLabel}>Supervisor Admin ID</Text>
                  <TextInput style={styles.input} value={adminIdCode} onChangeText={setAdminIdCode} placeholder="ADM-901" placeholderTextColor="#A0AEC0" autoCapitalize="characters" editable={!isEditing} />
                </View>
                <View style={{ width: '48%' }}>
                  <Text style={styles.inputLabel}>Inspection Node</Text>
                  <TextInput style={styles.input} value={adminDesignation} onChangeText={setAdminDesignation} placeholder="Logs Supervisor" placeholderTextColor="#A0AEC0" />
                </View>
              </View>

              <Text style={styles.inputLabel}>Supervisor Login Email</Text>
              <TextInput style={styles.input} value={adminEmail} onChangeText={setAdminEmail} placeholder="supervisor@medini.com" placeholderTextColor="#A0AEC0" keyboardType="email-address" autoCapitalize="none" />

              <Text style={styles.inputLabel}>Admin Access Password {isEditing ? '(Optional)' : ''}</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={adminPassword}
                  onChangeText={setAdminPassword}
                  placeholder={isEditing ? 'Leave blank to keep unchanged' : '••••••••'}
                  placeholderTextColor="#A0AEC0"
                  secureTextEntry={!showAdminPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.eyeIconBtn}
                  onPress={() => setShowAdminPassword(!showAdminPassword)}
                >
                  <Ionicons
                    name={showAdminPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#718096"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.formActionBtnGroup}>
                <TouchableOpacity style={[styles.submitButton, { backgroundColor: '#805AD5', flex: 1 }]} onPress={handleCreateAdminViewSubmit}>
                  <Ionicons name="shield-outline" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.submitButtonText}>{isEditing ? 'Save Admin View Changes' : 'Deploy Supervisor Account'}</Text>
                </TouchableOpacity>
                {isEditing && (
                  <TouchableOpacity style={styles.cancelEditBtn} onPress={clearAllFormStates}>
                    <Text style={styles.cancelEditBtnText}>Cancel</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* ACTIVE REGISTRY DIRECTORY LIST */}
          <View style={styles.sectionHeaderRowInline}>
            <Ionicons name="folder-open-outline" size={15} color="#2B6CB0" />
            <Text style={styles.sectionHeadingLabelInline}>System Master Accounts Directory</Text>
          </View>

          {/* 🔍 DIRECTORY SEARCH BAR */}
          <View style={styles.searchBarContainer}>
            <Ionicons name="search-outline" size={16} color="#718096" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, ID, designation, or email..."
              placeholderTextColor="#A0AEC0"
              value={empSearchQuery}
              onChangeText={setEmpSearchQuery}
            />
            {empSearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setEmpSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#A0AEC0" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.directoryCard}>
            {searchedEmployees.length === 0 ? (
              <Text style={styles.emptyTextSub}>
                {empSearchQuery ? `No profiles found matching "${empSearchQuery}".` : 'No active profiles connected inside database container.'}
              </Text>
            ) : (
              searchedEmployees.map((item) => {
                const roles: string[] = Array.isArray(item.role) ? item.role : [item.role || 'EMPLOYEE'];
                const isAdminView = roles.includes('ADMIN_VIEW');
                return (
                  <View key={item._id} style={styles.employeeRowItem}>
                    <View style={[styles.avatarCircle, isAdminView && { backgroundColor: '#FAF5FF', borderColor: '#D6BCFA' }]}>
                      {isAdminView ? (
                        <Ionicons name="eye" size={16} color="#805AD5" />
                      ) : (
                        <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                      )}
                    </View>
                    <View style={styles.employeeInfoBox}>
                      <Text style={styles.empRowName}>{item.name} <Text style={styles.empRowId}>({item.employeeId})</Text></Text>
                      <Text style={styles.empRowSub}>
                        {item.designation}  •  <Text style={{ fontWeight: '800' }}>{isAdminView ? 'ADMIN_VIEW' : 'EMPLOYEE'}</Text>
                        {item.lunchBreakMinutes !== undefined && item.lunchBreakMinutes > 0 ? ` • ${item.lunchBreakMinutes}m Lunch` : ''}
                      </Text>
                    </View>
                    <View style={styles.crudActionRow}>
                      <TouchableOpacity style={styles.actionPillEdit} onPress={() => handleSelectEditEmployee(item)}>
                        <Text style={styles.actionPillTextEdit}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionPillDelete} onPress={() => handleDeleteTrigger(item._id, item.name)}>
                        <Text style={styles.actionPillTextDelete}>Wipe</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      {activeTab === 'LOGS' && (
        <View style={{ flex: 1 }}>
          <View style={styles.sectionHeaderRowInline}>
            <Ionicons name="filter" size={14} color="#2B6CB0" />
            <Text style={styles.sectionHeadingLabelInline}>Workforce Filtering Focus</Text>
          </View>

          <View style={styles.searchBarContainer}>
            <Ionicons name="search-outline" size={16} color="#718096" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search workforce by employee name or ID..."
              placeholderTextColor="#A0AEC0"
              value={logSearchQuery}
              onChangeText={handleLogSearchChange}
            />
            {logSearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => handleLogSearchChange('')}>
                <Ionicons name="close-circle" size={18} color="#A0AEC0" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.pillScrollFrame}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity 
                style={[styles.filterPill, selectedEmpFilter === 'ALL' && styles.activeFilterPill]} 
                onPress={() => { setSelectedEmpFilter('ALL'); setLogSearchQuery(''); }}
              >
                <Text style={[styles.filterPillText, selectedEmpFilter === 'ALL' && styles.activeFilterPillText]}>🌐 Global Workforce</Text>
              </TouchableOpacity>
              {filteredWorkforceEmployees.map((emp) => (
                <TouchableOpacity 
                  key={emp._id} 
                  style={[styles.filterPill, selectedEmpFilter === emp.name && styles.activeFilterPill]} 
                  onPress={() => { setSelectedEmpFilter(emp.name); setLogSearchQuery(emp.name); }}
                >
                  <Text style={[styles.filterPillText, selectedEmpFilter === emp.name && styles.activeFilterPillText]}>👤 {emp.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.sectionHeaderRowInline}>
            <Ionicons name="calendar-outline" size={14} color="#2B6CB0" />
            <Text style={styles.sectionHeadingLabelInline}>Select Active Tracking Month ({new Date().getFullYear()})</Text>
          </View>
          <View style={[styles.pillScrollFrame, { marginBottom: 12 }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {availableMonths.map((month) => (
                <TouchableOpacity key={month} style={[styles.monthFilterPill, selectedMonthFilter === month && styles.activeMonthFilterPill]} onPress={() => setSelectedMonthFilter(month)}>
                  <Text style={[styles.monthFilterPillText, selectedMonthFilter === month && styles.activeMonthFilterPillText]}>📅 {month}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <TouchableOpacity style={styles.downloadFloatingBtn} activeOpacity={0.8} onPress={handleDownloadReport}>
            <Ionicons name="cloud-download" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.downloadFloatingBtnText}>Export {selectedMonthFilter} {new Date().getFullYear()} Sheet to CSV</Text>
          </TouchableOpacity>

          <View style={styles.sectionHeaderRowInline}>
            <Ionicons name="list" size={14} color="#2B6CB0" />
            <Text style={styles.sectionHeadingLabelInline}>{selectedMonthFilter} Shift Activity History Stream</Text>
          </View>
          
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
            {isLoading ? (
              <View style={styles.loaderCenterFrame}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loaderLabelSub}>Compiling cloud shift registers...</Text>
              </View>
            ) : searchedLogs.length === 0 ? (
              <View style={styles.emptyCardFrame}>
                <MaterialCommunityIcons name="folder-alert-outline" size={24} color="#A0AEC0" style={{ marginBottom: 6 }} />
                <Text style={styles.emptyTextMessage}>
                  {logSearchQuery ? `No logs found matching "${logSearchQuery}".` : `No logs recorded inside ${selectedMonthFilter} ${new Date().getFullYear()} for this item selection.`}
                </Text>
              </View>
            ) : (
              searchedLogs.map((logItem) => {
                const isAbsent = logItem.loginTime === 'ABSENT' || logItem.logoutTime === 'ABSENT';
                return (
                  <View key={logItem._id} style={[styles.dataLogCard, isAbsent && styles.dataLogCardAbsent]}>
                    <View style={styles.logCardHeader}>
                      <View>
                        <Text style={styles.logEmployeeIdentity}>{logItem.employeeName}</Text>
                        <Text style={styles.logEmployeeIdSub}>ID reference: {logItem.employeeIdReference}</Text>
                      </View>
                      <View style={[styles.dateBadge, isAbsent && { backgroundColor: '#FED7D7', borderColor: '#FEB2B2' }]}>
                        <Text style={[styles.dateBadgeText, isAbsent && { color: '#9B2C2C' }]}>{logItem.date}</Text>
                      </View>
                    </View>
                    <View style={styles.punchMetricsRow}>
                      <View style={[styles.metricBox, { backgroundColor: '#F0FDF4', borderColor: '#DCFCE7' }]}>
                        <Text style={[styles.metricLabel, { color: '#16A34A' }]}>HOURS WORKED</Text>
                        <Text style={[styles.metricTime, { color: '#15803D' }]}>
                          {calculateWorkingHours(logItem.loginTime, logItem.logoutTime, logItem.employeeName, logItem.employeeIdReference)}
                        </Text>
                      </View>
                      <View style={[styles.metricBox, isAbsent && { borderColor: '#FEB2B2', backgroundColor: '#FFF5F5' }]}>
                        <Text style={styles.metricLabel}>PUNCH IN</Text>
                        <Text style={[styles.metricTime, isAbsent ? { color: '#E53E3E' } : { color: '#2F855A' }]}>{logItem.loginTime}</Text>
                      </View>
                      <View style={[styles.metricBox, isAbsent && { borderColor: '#FEB2B2', backgroundColor: '#FFF5F5' }]}>
                        <Text style={styles.metricLabel}>PUNCH OUT</Text>
                        <Text style={[styles.metricTime, isAbsent ? { color: '#E53E3E' } : { color: '#4A5568' }]}>{logItem.logoutTime}</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      )}

      {/* 🍱 HOURS SELECTION DROPDOWN MODAL */}
      <Modal
        visible={showHoursDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowHoursDropdown(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowHoursDropdown(false)}>
          <View style={styles.dropdownModalCard}>
            <Text style={styles.dropdownModalTitle}>Select Lunch Break Hours</Text>
            <ScrollView style={{ maxHeight: 250 }}>
              {hoursList.map(h => (
                <TouchableOpacity
                  key={h}
                  style={[styles.dropdownItem, selectedLunchHours === h && styles.activeDropdownItem]}
                  onPress={() => {
                    setSelectedLunchHours(h);
                    setShowHoursDropdown(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, selectedLunchHours === h && styles.activeDropdownItemText]}>
                    {h} {h === 1 ? 'Hour' : 'Hours'}
                  </Text>
                  {selectedLunchHours === h && <Ionicons name="checkmark" size={16} color="#007AFF" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 🍱 MINUTES SELECTION DROPDOWN MODAL */}
      <Modal
        visible={showMinsDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMinsDropdown(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMinsDropdown(false)}>
          <View style={styles.dropdownModalCard}>
            <Text style={styles.dropdownModalTitle}>Select Lunch Break Minutes</Text>
            <ScrollView style={{ maxHeight: 250 }}>
              {minutesList.map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.dropdownItem, selectedLunchMins === m && styles.activeDropdownItem]}
                  onPress={() => {
                    setSelectedLunchMins(m);
                    setShowMinsDropdown(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, selectedLunchMins === m && styles.activeDropdownItemText]}>
                    {m} {m === 1 ? 'Minute' : 'Minutes'}
                  </Text>
                  {selectedLunchMins === m && <Ionicons name="checkmark" size={16} color="#007AFF" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingHorizontal: 16, paddingTop: 50 },
  headerHeroCard: { backgroundColor: '#1A202C', padding: 20, borderRadius: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerInfoBlock: { flex: 1 },
  headerSubtitle: { color: '#A0AEC0', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginTop: 2 },
  exitBadgeBtn: { backgroundColor: '#E53E3E', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, flexDirection: 'row', alignItems: 'center' },
  exitBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  summaryGridContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 16 },
  statBoxSummary: { width: '48.5%', borderRadius: 16, padding: 14, borderWidth: 1, backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.01, shadowRadius: 4, elevation: 1 },
  statBoxNumber: { fontSize: 22, fontWeight: '800', color: '#1A202C' },
  statBoxLabel: { fontSize: 11, fontWeight: '700', color: '#718096', marginTop: 3 },
  sectionHeaderRowInline: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingLeft: 2 },
  sectionHeadingLabelInline: { fontSize: 12, fontWeight: '800', color: '#4A5568', textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 6 },
  menuToggleRow: { flexDirection: 'row', backgroundColor: '#E2E8F0', padding: 4, borderRadius: 14, marginBottom: 18 },
  menuTab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, flexDirection: 'row', justifyContent: 'center' },
  activeMenuTab: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  menuTabText: { fontSize: 12, fontWeight: '700', color: '#718096' },
  activeMenuTabText: { color: '#007AFF' },
  formCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.01, shadowRadius: 4, elevation: 1 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionHeading: { fontSize: 13, fontWeight: '800', color: '#007AFF', textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 6 },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#718096', marginBottom: 5, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.3 },
  subInputLabel: { fontSize: 10, fontWeight: '700', color: '#A0AEC0', marginBottom: 4, textTransform: 'uppercase' },
  input: { backgroundColor: '#F7FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#2D3748', marginBottom: 4 },
  
  dropdownPickerRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 4 },
  dropdownTriggerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F7FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  dropdownValueText: { fontSize: 13, fontWeight: '700', color: '#2D3748' },
  lunchSummaryNote: { fontSize: 11, color: '#007AFF', fontWeight: '800', marginTop: 4, marginBottom: 6 },

  searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 12, paddingHorizontal: 12, height: 42, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 3, elevation: 1 },
  searchInput: { flex: 1, fontSize: 13, color: '#2D3748', fontWeight: '600' },

  passwordInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, marginBottom: 4 },
  passwordInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#2D3748' },
  eyeIconBtn: { paddingHorizontal: 12, paddingVertical: 10 },

  inlineInputsRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  formActionBtnGroup: { flexDirection: 'row', marginTop: 15, width: '100%' },
  submitButton: { backgroundColor: '#007AFF', paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  submitButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  cancelEditBtn: { borderColor: '#CBD5E0', borderWidth: 1, paddingHorizontal: 16, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginLeft: 8, backgroundColor: '#FFFFFF' },
  cancelEditBtnText: { color: '#4A5568', fontSize: 13, fontWeight: '600' },
  directoryCard: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.01, shadowRadius: 4, elevation: 1 },
  employeeRowItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EDF2F7' },
  avatarCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#EBF4FF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#BEE3F8' },
  avatarText: { color: '#007AFF', fontSize: 14, fontWeight: '800' },
  employeeInfoBox: { marginLeft: 12, flex: 1, paddingRight: 4 },
  empRowName: { fontSize: 14, fontWeight: '700', color: '#1A202C' },
  empRowId: { color: '#718096', fontWeight: '600', fontSize: 11 },
  empRowSub: { fontSize: 11, color: '#718096', marginTop: 2, fontWeight: '600', textTransform: 'uppercase' },
  crudActionRow: { flexDirection: 'row', alignItems: 'center' },
  actionPillEdit: { backgroundColor: '#EBF8FF', borderWidth: 1, borderColor: '#BEE3F8', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginRight: 5 },
  actionPillTextEdit: { color: '#2B6CB0', fontSize: 11, fontWeight: '700' },
  actionPillDelete: { backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FED7D7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  actionPillTextDelete: { color: '#E53E3E', fontSize: 11, fontWeight: '700' },
  pillScrollFrame: { maxHeight: 44, marginBottom: 12 },
  filterPill: { backgroundColor: '#E2E8F0', paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', borderRadius: 14, marginRight: 6, height: 36, borderWidth: 1, borderColor: '#CBD5E0' },
  activeFilterPill: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  filterPillText: { fontSize: 12, color: '#4A5568', fontWeight: '700' },
  activeFilterPillText: { color: '#FFFFFF' },
  monthFilterPill: { backgroundColor: '#EDF2F7', paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', borderRadius: 14, marginRight: 6, height: 36, borderWidth: 1, borderColor: '#E2E8F0' },
  activeMonthFilterPill: { backgroundColor: '#805AD5', borderColor: '#805AD5' },
  monthFilterPillText: { fontSize: 12, color: '#4A5568', fontWeight: '700' },
  activeMonthFilterPillText: { color: '#FFFFFF' },
  downloadFloatingBtn: { backgroundColor: '#38A169', paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 16, flexDirection: 'row', shadowColor: '#38A169', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 2 },
  downloadFloatingBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  dataLogCard: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.01, shadowRadius: 4, elevation: 1 },
  dataLogCardAbsent: { backgroundColor: '#FFF5F5', borderColor: '#FED7D7' },
  logCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EDF2F7', paddingBottom: 10, marginBottom: 12 },
  logEmployeeIdentity: { fontSize: 14, fontWeight: '800', color: '#2D3748' },
  logEmployeeIdSub: { fontSize: 11, fontWeight: '600', color: '#A0AEC0', marginTop: 1 },
  dateBadge: { backgroundColor: '#F7FAFC', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  dateBadgeText: { fontSize: 11, color: '#4A5568', fontWeight: '700' },
  punchMetricsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metricBox: { flex: 1, backgroundColor: '#F7FAFC', padding: 10, borderRadius: 12, alignItems: 'center', marginHorizontal: 2, borderWidth: 1, borderColor: '#E2E8F0' },
  metricLabel: { fontSize: 9, fontWeight: '800', color: '#A0AEC0', marginBottom: 2 },
  metricTime: { fontSize: 12, fontWeight: '800' },
  loaderCenterFrame: { paddingVertical: 50, alignItems: 'center', justifyContent: 'center' },
  loaderLabelSub: { color: '#718096', fontSize: 12, fontWeight: '600', marginTop: 12 },
  emptyCardFrame: { backgroundColor: '#FFFFFF', padding: 30, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  emptyTextMessage: { color: '#A0AEC0', fontSize: 12, fontStyle: 'italic', fontWeight: '600', textAlign: 'center', marginTop: 4 },
  emptyTextSub: { color: '#A0AEC0', fontSize: 12, fontWeight: '600', textAlign: 'center', marginVertical: 15, fontStyle: 'italic' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  dropdownModalCard: { width: '85%', maxWidth: 300, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', elevation: 5 },
  dropdownModalTitle: { fontSize: 13, fontWeight: '800', color: '#1A202C', marginBottom: 12, textTransform: 'uppercase', textAlign: 'center' },
  dropdownItem: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#EDF2F7', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  activeDropdownItem: { backgroundColor: '#EBF8FF' },
  dropdownItemText: { fontSize: 13, color: '#4A5568', fontWeight: '600' },
  activeDropdownItemText: { color: '#007AFF', fontWeight: '800' }
});