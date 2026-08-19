import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from './config';
import { 
  Users, 
  X, 
  Plus, 
  Wifi, 
  WifiOff, 
  AlertTriangle,
  Search,
  Copy,
  CheckCheck,
  User,
  PieChart,
  Bell,
  Sparkles,
  Edit3,
  Trash2,
  Shield,
  UserCheck,
  Layers,
  RefreshCw,
  Info,
  Grid,
  Sliders,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ArrowLeft
} from 'lucide-react';

interface SeatedParty {
  reservationId: string;
  name: string;
  seated_guests: number;
}

interface Reservation {
  id: string;
  name: string;
  phone_number: string;
  party_size: number; // Current unseated party size (order pop)
  original_party_size: number; // Original party size
  reservation_time: string;
  status: 'PENDING' | 'PARTIALLY_SEATED' | 'CONFIRMED' | 'CANCELLED';
  source: 'WHATSAPP' | 'WALK_IN' | 'TELEGRAM';
  table_id?: string;
  created_at: string;
  special_requests?: string;
  // WhatsApp / Telegram Bot ticket fields
  ticketType?: 'DINE_IN' | 'TAKEAWAY';
  cart?: Array<{ name: string; quantity: number; unitPrice: number }>;
  cartTotal?: number;
  orderRef?: string;
}

interface Table {
  id: string;
  name: string;
  capacity: number; // Total max capacity
  current_capacity: number; // Remaining available seats (table pop)
  seated_count: number; // Currently seated guests count
  status: 'AVAILABLE' | 'PARTIALLY_OCCUPIED' | 'OCCUPIED' | 'RESERVED';
  row: number; // Grid Cell Row Coordinate (0-indexed)
  col: number; // Grid Cell Column Coordinate (0-indexed)
  shape: 'CIRCLE' | 'RECTANGLE';
  seated_parties?: SeatedParty[];
}

const INITIAL_TABLES: Table[] = [
  { id: 'T1', name: 'T-01', capacity: 4, current_capacity: 4, seated_count: 0, status: 'AVAILABLE', row: 0, col: 0, shape: 'RECTANGLE', seated_parties: [] },
  { id: 'T2', name: 'T-02', capacity: 2, current_capacity: 2, seated_count: 0, status: 'AVAILABLE', row: 0, col: 2, shape: 'CIRCLE', seated_parties: [] },
  { id: 'T3', name: 'T-03', capacity: 6, current_capacity: 6, seated_count: 0, status: 'AVAILABLE', row: 0, col: 4, shape: 'RECTANGLE', seated_parties: [] },
  { id: 'T4', name: 'T-04', capacity: 4, current_capacity: 4, seated_count: 0, status: 'AVAILABLE', row: 2, col: 1, shape: 'CIRCLE', seated_parties: [] },
  { id: 'T5', name: 'T-05', capacity: 8, current_capacity: 8, seated_count: 0, status: 'AVAILABLE', row: 2, col: 4, shape: 'CIRCLE', seated_parties: [] },
];

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<Table[]>(INITIAL_TABLES);
  const [selectedBooking, setSelectedBooking] = useState<Reservation | null>(null);
  
  // App Mode State: RECEPTIONIST (Waitlist & Drag Seating) vs ADMIN (Floor Layout Editor)
  const [viewMode, setViewMode] = useState<'RECEPTIONIST' | 'ADMIN'>('RECEPTIONIST');

  // Admin Configurable Canvas Grid & Table Size Settings
  const [gridRows, setGridRows] = useState<number>(5); // Default 5 rows
  const [gridCols, setGridCols] = useState<number>(7); // Default 7 columns
  const [cellSize, setCellSize] = useState<number>(100); // Default 100px cell size

  // Canvas Zoom State (0.5x to 2.0x)
  const [zoomScale, setZoomScale] = useState<number>(1.0);

  const handleZoomIn = () => {
    setZoomScale((prev) => Math.min(2.0, Math.round((prev + 0.1) * 10) / 10));
  };

  const handleZoomOut = () => {
    setZoomScale((prev) => Math.max(0.5, Math.round((prev - 0.1) * 10) / 10));
  };

  const handleResetZoom = () => {
    setZoomScale(1.0);
  };

  // Drag & Drop visual tracking states
  const [dragOverCell, setDragOverCell] = useState<{ row: number; col: number } | null>(null);

  // Canvas Ref for Admin Dragging Positioning & Wheel Zoom Isolation
  const canvasRef = useRef<HTMLDivElement>(null);

  // Filtering & UI controls
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'PARTIALLY_SEATED' | 'CONFIRMED'>('ALL');
  const [tableFilter, setTableFilter] = useState<'ALL' | '2' | '4' | '6' | '8'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [activeTableModal, setActiveTableModal] = useState<Table | null>(null);
  const [showEditTableModal, setShowEditTableModal] = useState<Table | null>(null);
  const [showCustomTableModal, setShowCustomTableModal] = useState(false);

  // Admin Custom Table Form States
  const [customTableName, setCustomTableName] = useState('');
  const [customTableCapacity, setCustomTableCapacity] = useState(4);
  const [customTableShape, setCustomTableShape] = useState<'CIRCLE' | 'RECTANGLE'>('RECTANGLE');

  // Edit Table Form States
  const [editTableName, setEditTableName] = useState('');
  const [editTableCapacity, setEditTableCapacity] = useState(4);
  const [editTableShape, setEditTableShape] = useState<'CIRCLE' | 'RECTANGLE'>('RECTANGLE');
  const [editTableRow, setEditTableRow] = useState(0);
  const [editTableCol, setEditTableCol] = useState(0);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Phone Copy visual feedback
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  // Form states for walk-in
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [walkInGuests, setWalkInGuests] = useState(2);
  const [walkInTime, setWalkInTime] = useState('');
  const [walkInTable, setWalkInTable] = useState('');
  const [walkInNotes, setWalkInNotes] = useState('');

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Attach non-passive wheel listener to canvas container to block browser page zoom & keep website fit to frame
  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        setZoomScale((prev) => Math.min(2.0, Math.round((prev + 0.1) * 10) / 10));
      } else {
        setZoomScale((prev) => Math.max(0.5, Math.round((prev - 0.1) * 10) / 10));
      }
    };

    canvasEl.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      canvasEl.removeEventListener('wheel', handleNativeWheel);
    };
  }, []);

  useEffect(() => {
    // Connect to WebSockets server (Phase 4 ReservationsGateway)
    const socketUrl = API_BASE_URL || window.location.origin;
    const newSocket = io(socketUrl, {
      transports: ['websocket'],
      autoConnect: true,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      triggerToast('CONNECTED TO LIVE SEATING ENGINE');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      triggerToast('DISCONNECTED FROM WEBSOCKET SERVER');
    });

    // Real-time WhatsApp booking ingest listener
    newSocket.on('booking.created', (booking: any) => {
      const normalizedBooking: Reservation = {
        id: booking.id,
        name: booking.name,
        phone_number: booking.phone_number,
        party_size: booking.party_size,
        original_party_size: booking.party_size,
        reservation_time: booking.reservation_time,
        status: 'PENDING',
        source: booking.source === 'TELEGRAM_BOT' ? 'TELEGRAM' : (booking.source || 'WHATSAPP'),
        created_at: booking.created_at || new Date().toISOString(),
        special_requests: booking.special_requests,
        // WhatsApp / Telegram Bot ticket extras
        ticketType: booking.ticketType,
        cart: booking.cart,
        cartTotal: booking.cartTotal,
        orderRef: booking.orderRef,
      };
      setReservations((prev) => {
        if (prev.some((b) => b.id === normalizedBooking.id)) return prev;
        return [normalizedBooking, ...prev];
      });
      const typeLabel = booking.ticketType === 'TAKEAWAY' ? '🛍️ TAKEAWAY' : booking.ticketType === 'DINE_IN' ? '🍽️ DINE-IN' : '';
      triggerToast(`NEW ${typeLabel} TICKET: ${normalizedBooking.name} (${normalizedBooking.party_size > 0 ? normalizedBooking.party_size + ' PAX' : '₹' + booking.cartTotal})`);
    });


    newSocket.on('booking.updated', (updatedBooking: Reservation) => {
      setReservations((prev) =>
        prev.map((b) => (b.id === updatedBooking.id ? { ...b, ...updatedBooking } : b))
      );
    });

    // Initial seed data with sample party sizes
    setReservations([
      {
        id: '1',
        name: 'JULIAN VOGT',
        phone_number: '+41 79 342 11 00',
        party_size: 5,
        original_party_size: 5,
        reservation_time: new Date(Date.now() + 7200000).toISOString(),
        status: 'PENDING',
        source: 'WHATSAPP',
        created_at: new Date(Date.now() - 400000).toISOString(),
        special_requests: 'Window table requested. Anniversary celebration.'
      },
      {
        id: '2',
        name: 'ELARA CHEN',
        phone_number: '+41 79 888 22 11',
        party_size: 2,
        original_party_size: 2,
        reservation_time: new Date(Date.now() + 14400000).toISOString(),
        status: 'PENDING',
        source: 'WALK_IN',
        created_at: new Date(Date.now() - 900000).toISOString(),
      },
      {
        id: '3',
        name: 'MARCUS THORNE',
        phone_number: '+41 78 555 99 88',
        party_size: 7,
        original_party_size: 7,
        reservation_time: new Date(Date.now() + 18000000).toISOString(),
        status: 'PENDING',
        source: 'WHATSAPP',
        created_at: new Date(Date.now() - 2700000).toISOString(),
      }
    ]);

    return () => {
      newSocket.close();
    };
  }, []);

  // Filter & Search application
  const filteredReservations = reservations.filter((booking) => {
    const matchesFilter =
      filter === 'ALL' ||
      (filter === 'PENDING' && (booking.status === 'PENDING' || booking.status === 'PARTIALLY_SEATED')) ||
      (filter === 'PARTIALLY_SEATED' && booking.status === 'PARTIALLY_SEATED') ||
      (filter === 'CONFIRMED' && booking.status === 'CONFIRMED');

    const matchesSearch =
      booking.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.phone_number.includes(searchQuery);

    return matchesFilter && matchesSearch;
  });

  const filteredTables = tables.filter((t) => {
    if (tableFilter === 'ALL') return true;
    if (tableFilter === '2') return t.capacity <= 2;
    if (tableFilter === '4') return t.capacity === 4;
    if (tableFilter === '6') return t.capacity === 6;
    if (tableFilter === '8') return t.capacity >= 8;
    return true;
  });

  // Calculate live occupancy stats
  const totalCapacity = tables.reduce((acc, t) => acc + t.capacity, 0);
  const occupiedCapacity = tables.reduce((acc, t) => acc + t.seated_count, 0);
  const remainingTotalSeats = tables.reduce((acc, t) => acc + t.current_capacity, 0);
  const occupancyPercentage = totalCapacity > 0 ? Math.round((occupiedCapacity / totalCapacity) * 100) : 0;
  const pendingCount = reservations.filter((r) => r.status === 'PENDING' || r.status === 'PARTIALLY_SEATED').length;

  // Calculate minimum required grid rows & columns based on existing table positions
  const minRequiredRows = tables.length > 0 ? Math.max(...tables.map((t) => t.row)) + 1 : 1;
  const minRequiredCols = tables.length > 0 ? Math.max(...tables.map((t) => t.col)) + 1 : 1;

  const handleSetGridRows = (newRows: number) => {
    if (newRows < minRequiredRows) {
      triggerToast(`CANNOT SHRINK GRID ROWS BELOW ${minRequiredRows} — TABLES EXIST AT ROW ${minRequiredRows}`);
      return;
    }
    setGridRows(newRows);
  };

  const handleSetGridCols = (newCols: number) => {
    if (newCols < minRequiredCols) {
      triggerToast(`CANNOT SHRINK GRID COLS BELOW ${minRequiredCols} — TABLES EXIST AT COL ${minRequiredCols}`);
      return;
    }
    setGridCols(newCols);
  };

  // Calculate wait timer & color triggers
  const getWaitTimerDetails = (createdAt: string) => {
    const elapsedMs = Date.now() - new Date(createdAt).getTime();
    const elapsedMins = Math.floor(elapsedMs / 60000);

    let color = '#555555';
    let weight = '500';
    if (elapsedMins >= 5 && elapsedMins < 10) {
      color = '#000000';
      weight = '700';
    } else if (elapsedMins >= 10) {
      color = '#D62828';
      weight = '800';
    }

    return {
      text: `${elapsedMins} MIN`,
      color,
      weight
    };
  };

  // Copy phone helper
  const copyPhoneNumber = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedFeedback(true);
    triggerToast('PHONE NUMBER COPIED');
    setTimeout(() => setCopiedFeedback(false), 2000);
  };

  // ----------------------------------------------------
  // CORE SEATING DRAG & DROP LOGIC (RECEPTIONIST MODE)
  // ----------------------------------------------------

  const handleSeatOrderOnTable = (bookingId: string, tableId: string) => {
    const reservation = reservations.find((r) => r.id === bookingId);
    const table = tables.find((t) => t.id === tableId);

    if (!reservation || !table) return;

    const order_pop = reservation.party_size;
    const table_pop = table.current_capacity;

    if (table_pop <= 0) {
      triggerToast(`TABLE ${table.name} IS FULL! NO SEATS AVAILABLE.`);
      return;
    }

    if (table_pop < order_pop) {
      // Case 1: table_pop < order_pop
      const seatedGuests = table_pop;
      const remainingOrderPop = order_pop - table_pop;

      // Update Table: full capacity reached (0 seats left)
      setTables((prev) =>
        prev.map((t) => {
          if (t.id === tableId) {
            return {
              ...t,
              current_capacity: 0,
              seated_count: t.seated_count + seatedGuests,
              status: 'OCCUPIED',
              seated_parties: [
                ...(t.seated_parties || []),
                { reservationId: reservation.id, name: reservation.name, seated_guests: seatedGuests }
              ]
            };
          }
          return t;
        })
      );

      // Update Reservation: stays in queue list with (order_pop - table_pop) guests
      setReservations((prev) =>
        prev.map((r) => {
          if (r.id === bookingId) {
            return {
              ...r,
              party_size: remainingOrderPop,
              status: 'PARTIALLY_SEATED',
              table_id: tableId
            };
          }
          return r;
        })
      );

      triggerToast(
        `SEATED ${seatedGuests} GUESTS AT ${table.name}. ${remainingOrderPop} GUESTS REMAIN IN QUEUE FOR ${reservation.name}`
      );

    } else if (table_pop > order_pop) {
      // Case 2: table_pop > order_pop
      const seatedGuests = order_pop;
      const remainingTablePop = table_pop - order_pop;

      // Update Table: available capacity becomes (table_pop - order_pop)
      setTables((prev) =>
        prev.map((t) => {
          if (t.id === tableId) {
            return {
              ...t,
              current_capacity: remainingTablePop,
              seated_count: t.seated_count + seatedGuests,
              status: 'PARTIALLY_OCCUPIED',
              seated_parties: [
                ...(t.seated_parties || []),
                { reservationId: reservation.id, name: reservation.name, seated_guests: seatedGuests }
              ]
            };
          }
          return t;
        })
      );

      // Update Reservation: order fully seated
      setReservations((prev) =>
        prev.map((r) => {
          if (r.id === bookingId) {
            return {
              ...r,
              party_size: 0,
              status: 'CONFIRMED',
              table_id: tableId
            };
          }
          return r;
        })
      );

      triggerToast(
        `SEATED ${reservation.name} (${seatedGuests} PAX) AT ${table.name}. TABLE HAS ${remainingTablePop} SEATS REMAINING.`
      );

    } else {
      // Case 3: table_pop == order_pop
      const seatedGuests = order_pop;

      setTables((prev) =>
        prev.map((t) => {
          if (t.id === tableId) {
            return {
              ...t,
              current_capacity: 0,
              seated_count: t.seated_count + seatedGuests,
              status: 'OCCUPIED',
              seated_parties: [
                ...(t.seated_parties || []),
                { reservationId: reservation.id, name: reservation.name, seated_guests: seatedGuests }
              ]
            };
          }
          return t;
        })
      );

      setReservations((prev) =>
        prev.map((r) => {
          if (r.id === bookingId) {
            return {
              ...r,
              party_size: 0,
              status: 'CONFIRMED',
              table_id: tableId
            };
          }
          return r;
        })
      );

      triggerToast(
        `SEATED ${reservation.name} (${seatedGuests} PAX) AT ${table.name}. TABLE IS NOW FULLY OCCUPIED.`
      );
    }

    if (selectedBooking && selectedBooking.id === bookingId) {
      setSelectedBooking(null);
    }
  };

  // Cancel reservation
  const handleCancel = (bookingId: string) => {
    setReservations((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status: 'CANCELLED' } : b))
    );
    triggerToast('RESERVATION CANCELLED');
    setSelectedBooking(null);
  };

  // Vacate / Reset Table capacity back to full
  const handleVacateTable = (tableId: string) => {
    const tObj = tables.find((t) => t.id === tableId);
    if (!tObj) return;

    setTables((prev) =>
      prev.map((t) => {
        if (t.id === tableId) {
          return {
            ...t,
            current_capacity: t.capacity,
            seated_count: 0,
            seated_parties: [],
            status: 'AVAILABLE'
          };
        }
        return t;
      })
    );

    triggerToast(`TABLE ${tObj.name} VACATED. FULL CAPACITY (${tObj.capacity} PAX) RESTORED.`);
    setActiveTableModal(null);
  };

  // ----------------------------------------------------
  // ADMIN GRID MATRIX FLOOR LAYOUT EDITOR LOGIC
  // ----------------------------------------------------

  const handleAddTableToCell = (capacity: number, shape: 'CIRCLE' | 'RECTANGLE', targetRow: number, targetCol: number) => {
    const occupied = tables.some((t) => t.row === targetRow && t.col === targetCol);
    if (occupied) {
      triggerToast(`CELL [R:${targetRow + 1}, C:${targetCol + 1}] IS ALREADY OCCUPIED BY A TABLE.`);
      return;
    }

    const tableIndex = tables.length + 1;
    const nameStr = `T-${tableIndex < 10 ? '0' + tableIndex : tableIndex}`;

    const newTable: Table = {
      id: `T${Date.now()}`,
      name: nameStr,
      capacity,
      current_capacity: capacity,
      seated_count: 0,
      status: 'AVAILABLE',
      row: targetRow,
      col: targetCol,
      shape,
      seated_parties: []
    };

    setTables((prev) => [...prev, newTable]);
    triggerToast(`ADDED TABLE ${nameStr} (${capacity} PAX) AT GRID CELL [R:${targetRow + 1}, C:${targetCol + 1}]`);
  };

  const handleMoveExistingTableToCell = (tableId: string, targetRow: number, targetCol: number) => {
    const occupied = tables.some((t) => t.id !== tableId && t.row === targetRow && t.col === targetCol);
    if (occupied) {
      triggerToast(`CELL [R:${targetRow + 1}, C:${targetCol + 1}] IS OCCUPIED BY ANOTHER TABLE.`);
      return;
    }

    setTables((prev) =>
      prev.map((t) => (t.id === tableId ? { ...t, row: targetRow, col: targetCol } : t))
    );
    triggerToast(`MOVED TABLE TO GRID CELL [R:${targetRow + 1}, C:${targetCol + 1}]`);
  };

  const handleCellDrop = (e: React.DragEvent<HTMLDivElement>, r: number, c: number) => {
    e.preventDefault();
    e.stopPropagation();

    // 1. Admin mode dropping a new table template into cell (r, c)
    const templateData = e.dataTransfer.getData('application/table-template');
    if (templateData && viewMode === 'ADMIN') {
      try {
        const { capacity, shape } = JSON.parse(templateData);
        handleAddTableToCell(capacity, shape, r, c);
        return;
      } catch (err) {
        console.error('Failed to parse table template drag data', err);
      }
    }

    // 2. Admin mode moving an existing table into cell (r, c)
    const existingTableId = e.dataTransfer.getData('application/table-move-id');
    if (existingTableId && viewMode === 'ADMIN') {
      handleMoveExistingTableToCell(existingTableId, r, c);
      return;
    }

    // 3. Receptionist mode dropping queued order onto table at cell (r, c)
    if (viewMode === 'RECEPTIONIST') {
      const reservationId = e.dataTransfer.getData('text/plain');
      const tableAtCell = tables.find((t) => t.row === r && t.col === c);
      if (reservationId && tableAtCell) {
        handleSeatOrderOnTable(reservationId, tableAtCell.id);
      }
    }
  };

  const handleDeleteTable = (tableId: string) => {
    const tObj = tables.find((t) => t.id === tableId);
    setTables((prev) => prev.filter((t) => t.id !== tableId));
    setShowEditTableModal(null);
    triggerToast(`DELETED TABLE ${tObj?.name || tableId}`);
  };

  const handleSaveEditedTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditTableModal) return;

    const collision = tables.some(
      (t) => t.id !== showEditTableModal.id && t.row === editTableRow && t.col === editTableCol
    );
    if (collision) {
      alert(`Grid Cell [Row ${editTableRow + 1}, Col ${editTableCol + 1}] is already occupied.`);
      return;
    }

    setTables((prev) =>
      prev.map((t) => {
        if (t.id === showEditTableModal.id) {
          const capDiff = editTableCapacity - t.capacity;
          const newCurrentCap = Math.max(0, t.current_capacity + capDiff);
          return {
            ...t,
            name: editTableName.toUpperCase(),
            capacity: editTableCapacity,
            current_capacity: newCurrentCap,
            shape: editTableShape,
            row: editTableRow,
            col: editTableCol
          };
        }
        return t;
      })
    );

    triggerToast(`UPDATED TABLE ${editTableName.toUpperCase()} [R:${editTableRow + 1}, C:${editTableCol + 1}]`);
    setShowEditTableModal(null);
  };

  const handleCreateCustomTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTableName) return;

    let targetR = 0, targetC = 0, found = false;
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        if (!tables.some(t => t.row === r && t.col === c)) {
          targetR = r;
          targetC = c;
          found = true;
          break;
        }
      }
      if (found) break;
    }

    handleAddTableToCell(customTableCapacity, customTableShape, targetR, targetC);
    setCustomTableName('');
    setCustomTableCapacity(4);
    setShowCustomTableModal(false);
  };

  const handleAddWalkIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkInName || !walkInPhone) return;

    const newBooking: Reservation = {
      id: `walk-in-${Date.now()}`,
      name: walkInName.toUpperCase(),
      phone_number: walkInPhone,
      party_size: walkInGuests,
      original_party_size: walkInGuests,
      reservation_time: walkInTime ? new Date(walkInTime).toISOString() : new Date().toISOString(),
      status: 'PENDING',
      source: 'WALK_IN',
      created_at: new Date().toISOString(),
      special_requests: walkInNotes,
    };

    setReservations((prev) => [newBooking, ...prev]);

    if (walkInTable) {
      handleSeatOrderOnTable(newBooking.id, walkInTable);
    } else {
      triggerToast(`WALK-IN BOOKING ADDED TO QUEUE FOR ${walkInName.toUpperCase()} (${walkInGuests} PAX)`);
    }

    // Reset Form
    setWalkInName('');
    setWalkInPhone('');
    setWalkInGuests(2);
    setWalkInTime('');
    setWalkInTable('');
    setWalkInNotes('');
    setShowWalkInModal(false);
  };

  const surfaceSize = Math.round(cellSize * 0.62);
  const seatRadius = Math.round(cellSize * 0.38);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#ffffff', color: '#111111', overflow: 'hidden' }}>
      
      {/* Toast Notification Container */}
      {toastMessage && (
        <div className="toast-notification">
          <Sparkles size={16} color="var(--brand-red)" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Integrated Left Vertical Sidebar (Holds Navigation AND Waitlist Queue) */}
      <aside style={{ width: '320px', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff', height: '100vh', overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ padding: '20px 20px 12px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.5px', color: 'var(--brand-red)' }}>
            GRANIERI'S
          </h1>
          <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.7 }}>
            Table Management Engine
          </span>

          {/* View Mode Switcher */}
          <div style={{ marginTop: '12px' }}>
            <div className="mode-switch-container" style={{ width: '100%' }}>
              <button
                onClick={() => {
                  setViewMode('RECEPTIONIST');
                  triggerToast('SWITCHED TO RECEPTIONIST SEATING MODE');
                }}
                className={`mode-switch-btn ${viewMode === 'RECEPTIONIST' ? 'active-receptionist' : ''}`}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                <UserCheck size={12} /> Receptionist
              </button>
              <button
                onClick={() => {
                  setViewMode('ADMIN');
                  triggerToast('SWITCHED TO ADMIN FLOOR LAYOUT EDITOR');
                }}
                className={`mode-switch-btn ${viewMode === 'ADMIN' ? 'active-admin' : ''}`}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                <Shield size={12} /> Admin
              </button>
            </div>
          </div>
        </div>

        {/* Integrated Waitlist Queue Panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--off-white)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Waitlist Queue ({filteredReservations.length})
              </h2>
              {pendingCount > 0 && (
                <span style={{ fontSize: '0.62rem', fontWeight: 900, color: 'white', backgroundColor: 'var(--brand-red)', padding: '1px 6px', borderRadius: '10px' }}>
                  {pendingCount} PENDING
                </span>
              )}
            </div>

            {viewMode === 'RECEPTIONIST' && (
              <p style={{ fontSize: '0.6rem', color: 'var(--brand-red)', fontWeight: 700, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Info size={11} /> Drag card to table or click for ticket details
              </p>
            )}

            <div className="filter-tabs" style={{ marginTop: '8px' }}>
              {(['ALL', 'PENDING', 'PARTIALLY_SEATED', 'CONFIRMED'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab as any)}
                  className={`filter-tab-btn ${filter === tab ? 'active' : ''}`}
                  style={{ fontSize: '0.56rem' }}
                >
                  {tab === 'PARTIALLY_SEATED' ? 'PARTIAL' : tab}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: 'var(--border-color)' }}>
            {filteredReservations.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: '#ffffff' }}>
                <p style={{ fontSize: '0.72rem', fontWeight: 700 }}>NO QUEUED BOOKINGS</p>
              </div>
            ) : (
              filteredReservations.map((booking) => {
                const timer = getWaitTimerDetails(booking.created_at);
                const isSelected = selectedBooking?.id === booking.id;
                const isDraggable = viewMode === 'RECEPTIONIST' && booking.status !== 'CONFIRMED';

                return (
                  <div
                    key={booking.id}
                    draggable={isDraggable}
                    onDragStart={(e) => {
                      if (!isDraggable) return;
                      e.dataTransfer.setData('text/plain', booking.id);
                    }}
                    onClick={() => setSelectedBooking(booking)}
                    className={isDraggable ? 'queue-card-draggable' : ''}
                    style={{
                      padding: '12px 16px',
                      backgroundColor: isSelected ? 'var(--brand-red-light)' : '#ffffff',
                      borderLeft: isSelected ? '4px solid var(--brand-red)' : '4px solid transparent',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease'
                    }}
                  >
                    {/* Row 1: Name + timer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <h3 style={{ fontSize: '0.82rem', fontWeight: 800, color: '#000000' }}>{booking.name}</h3>
                        {booking.status === 'PARTIALLY_SEATED' && (
                          <span className="badge-capacity badge-capacity-partial">PARTIAL</span>
                        )}
                      </div>

                      {booking.status === 'PENDING' || booking.status === 'PARTIALLY_SEATED' ? (
                        <span style={{ fontSize: '0.65rem', fontWeight: timer.weight as any, color: timer.color }}>
                          {timer.text}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--status-confirmed-text)' }}>
                          {booking.status}
                        </span>
                      )}
                    </div>

                    {/* Row 2: PAX count + source badge + ticket type badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: booking.cart && booking.cart.length > 0 ? '8px' : '0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: '#000000', fontWeight: 800 }}>
                        <Users size={12} color="var(--brand-red)" />
                        <span>
                          {booking.ticketType === 'TAKEAWAY'
                            ? <span style={{ color: '#555' }}>TAKEAWAY ORDER</span>
                            : <>QUEUED: <strong style={{ color: 'var(--brand-red)', fontSize: '0.82rem' }}>{booking.party_size} PAX</strong>
                              {booking.original_party_size > booking.party_size && (
                                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600, marginLeft: '4px' }}>
                                  ({booking.original_party_size} orig)
                                </span>
                              )}
                            </>
                          }
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {booking.ticketType && (
                          <span style={{
                            fontSize: '0.55rem', fontWeight: 900,
                            backgroundColor: booking.ticketType === 'TAKEAWAY' ? '#FFF3CD' : '#E8F5E9',
                            color: booking.ticketType === 'TAKEAWAY' ? '#7B5500' : '#1B5E20',
                            padding: '2px 5px', borderRadius: '2px', textTransform: 'uppercase'
                          }}>
                            {booking.ticketType === 'TAKEAWAY' ? '🛍️' : '🍽️'} {booking.ticketType}
                          </span>
                        )}
                        <span style={{
                          fontSize: '0.58rem', fontWeight: 800,
                          backgroundColor: booking.source === 'TELEGRAM' ? '#EBF5FB' : booking.source === 'WHATSAPP' ? 'var(--brand-red-light)' : 'var(--light-grey)',
                          color: booking.source === 'TELEGRAM' ? '#1A5276' : booking.source === 'WHATSAPP' ? 'var(--brand-red)' : '#111111',
                          padding: '2px 5px', borderRadius: '2px'
                        }}>
                          {booking.source === 'TELEGRAM' ? '✈️ TG' : booking.source === 'WHATSAPP' ? 'WA' : 'WALK'}
                        </span>
                      </div>
                    </div>

                    {/* Row 3: Cart items (only for bot-submitted tickets) */}
                    {booking.cart && booking.cart.length > 0 && (
                      <div style={{
                        background: '#F8F8F8', borderRadius: '4px', padding: '6px 8px',
                        marginBottom: '8px', border: '1px solid #EEEEEE'
                      }}>
                        {booking.cart.map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#333', marginBottom: '2px' }}>
                            <span>{item.name} × {item.quantity}</span>
                            <span style={{ fontWeight: 700 }}>₹{item.quantity * item.unitPrice}</span>
                          </div>
                        ))}
                        <div style={{ borderTop: '1px dashed #CCCCCC', marginTop: '4px', paddingTop: '4px', display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', fontWeight: 900 }}>
                          <span>TOTAL</span>
                          <span style={{ color: 'var(--brand-red)' }}>₹{booking.cartTotal}</span>
                        </div>
                        {booking.orderRef && (
                          <div style={{ fontSize: '0.55rem', color: '#888', marginTop: '2px' }}>Ref: #{booking.orderRef}</div>
                        )}
                      </div>
                    )}

                    {/* Row 4: Confirm / Cancel action buttons (only for PENDING WhatsApp/Telegram bot tickets) */}
                    {(booking.source === 'WHATSAPP' || booking.source === 'TELEGRAM') && (booking.ticketType === 'DINE_IN' || booking.ticketType === 'TAKEAWAY') && booking.status === 'PENDING' && (
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={async () => {
                            try {
                              await fetch(`${API_BASE_URL}/webhook/tickets/${booking.id}/resolve`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ resolution: 'CONFIRMED' }),
                              });
                              setReservations((prev) => prev.map((r) => r.id === booking.id ? { ...r, status: 'CONFIRMED' } : r));
                              triggerToast(`✅ TICKET CONFIRMED — GUEST NOTIFIED ON WHATSAPP`);
                            } catch { triggerToast('ERROR CONFIRMING TICKET'); }
                          }}
                          style={{
                            flex: 1, padding: '5px 0', fontSize: '0.62rem', fontWeight: 800,
                            backgroundColor: '#000000', color: '#ffffff',
                            border: 'none', borderRadius: '3px', cursor: 'pointer', letterSpacing: '0.5px'
                          }}
                        >
                          ✅ CONFIRM
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await fetch(`${API_BASE_URL}/webhook/tickets/${booking.id}/resolve`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ resolution: 'CANCELLED' }),
                              });
                              setReservations((prev) => prev.map((r) => r.id === booking.id ? { ...r, status: 'CANCELLED' } : r));
                              triggerToast(`❌ TICKET CANCELLED — GUEST NOTIFIED`);
                            } catch { triggerToast('ERROR CANCELLING TICKET'); }
                          }}
                          style={{
                            flex: 1, padding: '5px 0', fontSize: '0.62rem', fontWeight: 800,
                            backgroundColor: '#ffffff', color: '#D62828',
                            border: '1px solid #D62828', borderRadius: '3px', cursor: 'pointer', letterSpacing: '0.5px'
                          }}
                        >
                          ✗ CANCEL
                        </button>
                      </div>
                    )}
                  </div>
                );

              })
            )}
          </div>
        </div>

        {/* Sidebar Footer Action */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', backgroundColor: '#ffffff' }}>
          <button 
            onClick={() => setShowWalkInModal(true)}
            className="btn-solid-black"
            style={{ width: '100%', justifyContent: 'center', padding: '10px 0' }}
          >
            <Plus size={14} /> New Walk-In Booking
          </button>
        </div>
      </aside>

      {/* 2. Main Expanded Workspace (Floor Plan Map Canvas) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* Top AppBar with Search and Live Metrics */}
        <header className="header-bar">
          <div style={{ display: 'flex', alignItems: 'center', flexGrow: 1, maxWidth: '340px', position: 'relative' }}>
            <Search size={14} color="#888888" style={{ position: 'absolute', left: '10px' }} />
            <input 
              type="text" 
              placeholder="SEARCH RESERVATIONS..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input-field"
            />
          </div>

          {/* Shift Live Micro Metrics Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="metric-pill">
              <PieChart size={12} color="var(--black)" />
              <span>OCCUPANCY: <strong style={{ color: 'var(--black)' }}>{occupancyPercentage}%</strong></span>
            </div>
            
            <div className={`metric-pill ${pendingCount > 0 ? 'metric-pill-highlight' : ''}`}>
              <Bell size={12} />
              <span>WAITLIST: <strong>{pendingCount} PENDING</strong></span>
            </div>

            <div className="metric-pill">
              <Users size={12} color="var(--black)" />
              <span>SEATS: <strong>{occupiedCapacity}/{totalCapacity} PAX</strong> ({remainingTotalSeats} AVAIL)</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {/* View Mode Status Indicator Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 10px', backgroundColor: viewMode === 'ADMIN' ? 'var(--brand-red-light)' : 'var(--light-grey)', border: viewMode === 'ADMIN' ? '1px solid var(--brand-red)' : '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 800, color: viewMode === 'ADMIN' ? 'var(--brand-red)' : 'var(--black)' }}>
              {viewMode === 'ADMIN' ? <Edit3 size={12} /> : <UserCheck size={12} />}
              <span>{viewMode === 'ADMIN' ? 'ADMIN LAYOUT EDITOR' : 'RECEPTIONIST MODE'}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isConnected ? (
                <Wifi size={14} color="#000000" />
              ) : (
                <WifiOff size={14} color="var(--brand-red)" />
              )}
              <div style={{ width: '28px', height: '28px', backgroundColor: 'var(--light-grey)', borderRadius: '4px', border: '1px solid var(--black)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={16} />
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic disconnect warning */}
        {!isConnected && (
          <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid var(--brand-red)', color: 'var(--brand-red)', paddingTop: '8px', paddingBottom: '8px', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', backgroundColor: '#ffffff', textAlign: 'center', width: '100%', justifyContent: 'center' }}>
            <AlertTriangle size={14} /> SYSTEM OFFLINE — SHOWING CACHED SEATING STATES.
          </div>
        )}

        {/* Admin Canvas & Table Size Configurator Ribbon (Visible only in Admin Mode) */}
        {viewMode === 'ADMIN' && (
          <div className="admin-palette-bar" style={{ flexDirection: 'column', gap: '10px', alignItems: 'stretch', padding: '12px 20px' }}>
            
            {/* Row 1: Canvas & Table Size Customizer Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--brand-red)' }}>
                  <Sliders size={14} />
                  <span>ADMIN CANVAS & TABLE CONFIGURATOR:</span>
                </div>

                <div className="admin-controls-group">
                  <Grid size={12} />
                  <span>GRID ROWS:</span>
                  <select 
                    value={gridRows} 
                    onChange={(e) => handleSetGridRows(parseInt(e.target.value))}
                    className="admin-select-input"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15].map(r => (
                      <option key={r} value={r} disabled={r < minRequiredRows}>
                        {r} ROWS {r < minRequiredRows ? '🔒 (Tables Exist)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="admin-controls-group">
                  <Grid size={12} />
                  <span>GRID COLS:</span>
                  <select 
                    value={gridCols} 
                    onChange={(e) => handleSetGridCols(parseInt(e.target.value))}
                    className="admin-select-input"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 20].map(c => (
                      <option key={c} value={c} disabled={c < minRequiredCols}>
                        {c} COLS {c < minRequiredCols ? '🔒 (Tables Exist)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="admin-controls-group">
                  <Sliders size={12} />
                  <span>TABLE / CELL SIZE:</span>
                  <select 
                    value={cellSize} 
                    onChange={(e) => setCellSize(parseInt(e.target.value))}
                    className="admin-select-input"
                  >
                    <option value={70}>SMALL (70px)</option>
                    <option value={90}>MEDIUM (90px)</option>
                    <option value={100}>LARGE (100px)</option>
                    <option value={120}>XLARGE (120px)</option>
                    <option value={140}>XXLARGE (140px)</option>
                  </select>
                </div>
              </div>

              <div style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                CANVAS: {gridCols * cellSize}px × {gridRows * cellSize}px ({gridRows * gridCols} TOTAL CELL SLOTS)
              </div>
            </div>

            {/* Row 2: Table Template Drag Palette */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem', fontWeight: 900, textTransform: 'uppercase', color: '#000000' }}>
                <Layers size={13} />
                <span>DRAG TABLE TEMPLATE TO ANY CELL:</span>
              </div>

              {([1, 2, 3, 4, 6, 8] as const).map((cap) => (
                <div
                  key={cap}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/table-template', JSON.stringify({ capacity: cap, shape: (cap <= 2 || cap === 8) ? 'CIRCLE' : 'RECTANGLE' }));
                  }}
                  className="palette-item"
                >
                  <Plus size={12} color="var(--brand-red)" />
                  <span>{cap} PAX TABLE</span>
                </div>
              ))}

              <button
                onClick={() => setShowCustomTableModal(true)}
                className="btn-ghost"
                style={{ padding: '5px 10px', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Plus size={12} /> Custom Table
              </button>

              <button
                onClick={() => {
                  setTables(INITIAL_TABLES);
                  setGridRows(5);
                  setGridCols(7);
                  setCellSize(100);
                  triggerToast('RESTORED DEFAULT FLOOR LAYOUT & GRID DIMENSIONS');
                }}
                className="btn-ghost"
                style={{ marginLeft: 'auto', padding: '5px 10px', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <RefreshCw size={12} /> Reset Layout
              </button>
            </div>

          </div>
        )}

        {/* Expanded Floor Canvas Area */}
        <section style={{ flex: 1, backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px', backgroundColor: '#ffffff', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <h2 style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {viewMode === 'ADMIN' ? 'Grid Matrix Floor Editor (Every Cell Interactive)' : 'Main Dining Seating Floor Plan'}
              </h2>
              
              {/* Table Pax Filter Pills */}
              <div className="filter-tabs">
                {(['ALL', '2', '4', '6', '8'] as const).map((cap) => (
                  <button
                    key={cap}
                    onClick={() => setTableFilter(cap)}
                    className={`filter-tab-btn ${tableFilter === cap ? 'active' : ''}`}
                    style={{ padding: '3px 8px' }}
                  >
                    {cap === 'ALL' ? 'ALL' : `${cap} PAX`}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '12px', fontSize: '0.65rem', fontWeight: 800 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', backgroundColor: 'var(--brand-red)', borderRadius: '50%' }} /> Full (0 Seats)
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', backgroundColor: '#ff9f1c', borderRadius: '50%' }} /> Partial
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', border: '1px solid #000000', backgroundColor: '#ffffff', borderRadius: '50%' }} /> Available
                </span>
              </div>

              {/* Sleek Zoom In / Out Control Bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--light-grey)', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                <button 
                  onClick={handleZoomOut} 
                  disabled={zoomScale <= 0.5}
                  title="Zoom Out (Scroll Down)"
                  style={{ background: 'none', border: 'none', cursor: zoomScale <= 0.5 ? 'not-allowed' : 'pointer', opacity: zoomScale <= 0.5 ? 0.4 : 1, display: 'flex', alignItems: 'center', color: '#111111', padding: '2px' }}
                >
                  <ZoomOut size={13} />
                </button>
                
                <button 
                  onClick={handleResetZoom}
                  title="Reset Zoom to 100%"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 800, padding: '0 4px', minWidth: '42px', textAlign: 'center', color: zoomScale !== 1.0 ? 'var(--brand-red)' : '#111111' }}
                >
                  {Math.round(zoomScale * 100)}%
                </button>

                <button 
                  onClick={handleZoomIn} 
                  disabled={zoomScale >= 2.0}
                  title="Zoom In (Scroll Up)"
                  style={{ background: 'none', border: 'none', cursor: zoomScale >= 2.0 ? 'not-allowed' : 'pointer', opacity: zoomScale >= 2.0 ? 0.4 : 1, display: 'flex', alignItems: 'center', color: '#111111', padding: '2px' }}
                >
                  <ZoomIn size={13} />
                </button>

                <button 
                  onClick={handleResetZoom}
                  title="Reset Canvas Scale"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px', marginLeft: '4px', borderLeft: '1px solid var(--border-color)', paddingLeft: '6px' }}
                >
                  <Maximize2 size={12} color="var(--text-secondary)" />
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Grid Matrix Canvas Container */}
          <div 
            ref={canvasRef}
            style={{ 
              flex: 1, 
              position: 'relative', 
              overflow: 'auto', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              padding: '48px',
              backgroundColor: '#ffffff'
            }}
          >
            <div style={{
              display: 'grid',
              gridTemplateRows: `repeat(${gridRows}, ${cellSize}px)`,
              gridTemplateColumns: `repeat(${gridCols}, ${cellSize}px)`,
              position: 'relative',
              width: `${gridCols * cellSize}px`,
              height: `${gridRows * cellSize}px`,
              backgroundColor: '#ffffff',
              border: 'none',
              boxShadow: viewMode === 'ADMIN' ? '0 0 0 1px rgba(214, 40, 40, 0.3)' : 'none',
              transform: `scale(${zoomScale})`,
              transformOrigin: 'center center',
              transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
              userSelect: 'none'
            }}>

              {/* Explicit Cell Slots for Every Single Row & Column */}
              {Array.from({ length: gridRows * gridCols }).map((_, idx) => {
                const r = Math.floor(idx / gridCols);
                const c = idx % gridCols;
                const table = filteredTables.find((t) => t.row === r && t.col === c);
                const isCellHovered = dragOverCell?.row === r && dragOverCell?.col === c;

                return (
                  <div
                    key={`cell-${r}-${c}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      setDragOverCell({ row: r, col: c });
                    }}
                    onDragLeave={() => {
                      if (dragOverCell?.row === r && dragOverCell?.col === c) {
                        setDragOverCell(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverCell(null);
                      handleCellDrop(e, r, c);
                    }}
                    style={{
                      width: `${cellSize}px`,
                      height: `${cellSize}px`,
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 'none',
                      backgroundColor: isCellHovered 
                        ? (viewMode === 'ADMIN' ? 'rgba(214, 40, 40, 0.08)' : 'rgba(0, 0, 0, 0.04)') 
                        : 'transparent',
                      boxShadow: isCellHovered ? 'inset 0 0 0 2px var(--brand-red)' : 'none',
                      transition: 'background-color 0.15s ease, box-shadow 0.15s ease'
                    }}
                  >
                    {table ? (
                      <div
                        draggable={viewMode === 'ADMIN'}
                        onDragStart={(e) => {
                          if (viewMode !== 'ADMIN') return;
                          e.dataTransfer.setData('application/table-move-id', table.id);
                        }}
                        onClick={() => {
                          if (viewMode === 'ADMIN') {
                            setEditTableName(table.name);
                            setEditTableCapacity(table.capacity);
                            setEditTableShape(table.shape);
                            setEditTableRow(table.row);
                            setEditTableCol(table.col);
                            setShowEditTableModal(table);
                          } else {
                            setActiveTableModal(table);
                          }
                        }}
                        className="table-node"
                        style={{
                          width: `${cellSize}px`,
                          height: `${cellSize}px`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: viewMode === 'ADMIN' ? 'move' : 'pointer',
                          position: 'relative'
                        }}
                      >
                        {/* Hover Tooltip */}
                        <div className="tooltip-box" style={{ width: '190px', whiteSpace: 'normal', textAlign: 'center' }}>
                          <strong>{table.name} ({table.capacity} PAX Max)</strong><br />
                          Cell Coordinate: <strong>[Row {table.row + 1}, Col {table.col + 1}]</strong><br />
                          Remaining Seats (table pop): <strong>{table.current_capacity} PAX</strong><br />
                          Seated Guests: {table.seated_count}/{table.capacity}
                          {table.seated_parties && table.seated_parties.length > 0 && (
                            <div style={{ marginTop: '4px', borderTop: '1px solid #444', paddingTop: '4px', fontSize: '0.58rem' }}>
                              {table.seated_parties.map((p, i) => (
                                <div key={i}>{p.name}: {p.seated_guests} PAX</div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Seats */}
                        {Array.from({ length: table.capacity }).map((_, seatIdx) => {
                          const angle = (seatIdx * 360) / table.capacity;
                          const isSeatedSeat = seatIdx < table.seated_count;
                          return (
                            <div
                              key={seatIdx}
                              style={{
                                position: 'absolute',
                                width: '9px',
                                height: '9px',
                                backgroundColor: isSeatedSeat ? 'var(--brand-red)' : '#ffffff',
                                border: '1px solid #000000',
                                borderRadius: '50%',
                                transform: `rotate(${angle}deg) translate(${seatRadius}px) rotate(-${angle}deg)`,
                                transition: 'all 0.15s ease',
                                opacity: isSeatedSeat ? 1 : 0.4
                              }}
                            />
                          );
                        })}

                        {/* Table Surface */}
                        <div style={{
                          width: `${surfaceSize}px`,
                          height: `${surfaceSize}px`,
                          border: table.current_capacity === 0 
                            ? '1px solid var(--brand-red)' 
                            : (table.current_capacity < table.capacity ? '2px dashed #ff9f1c' : '1px solid #000000'),
                          backgroundColor: table.current_capacity === 0 
                            ? 'var(--brand-red)' 
                            : (table.current_capacity < table.capacity ? '#fffdf5' : '#ffffff'),
                          borderRadius: table.shape === 'CIRCLE' ? '50%' : '3px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s ease',
                          boxShadow: table.current_capacity === 0 ? '2px 2px 0px 0px rgba(0,0,0,0.1)' : 'none'
                        }}>
                          <span style={{ fontSize: `${Math.max(0.6, cellSize * 0.0075)}rem`, fontWeight: 900, color: table.current_capacity === 0 ? '#ffffff' : '#000000' }}>
                            {table.name}
                          </span>
                          
                          <span style={{ 
                            fontSize: `${Math.max(0.45, cellSize * 0.005)}rem`, 
                            fontWeight: 900, 
                            color: table.current_capacity === 0 ? '#ffffff' : (table.current_capacity < table.capacity ? '#d35400' : 'var(--text-secondary)'), 
                            marginTop: '1px',
                            textTransform: 'uppercase' 
                          }}>
                            {table.current_capacity === 0 ? 'FULL' : `${table.current_capacity} AVAIL`}
                          </span>

                          <span style={{ fontSize: `${Math.max(0.4, cellSize * 0.0045)}rem`, opacity: 0.8, color: table.current_capacity === 0 ? '#ffffff' : '#000000' }}>
                            Max {table.capacity}p
                          </span>
                        </div>
                      </div>
                    ) : (
                      viewMode === 'ADMIN' && isCellHovered && (
                        <div style={{ fontSize: '0.58rem', fontWeight: 900, color: 'var(--brand-red)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          DROP HERE
                        </div>
                      )
                    )}
                  </div>
                );
              })}

              {/* Watermark */}
              <div style={{ position: 'absolute', bottom: '12px', right: '12px', opacity: 0.06, pointerEvents: 'none', userSelect: 'none' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 900, textTransform: 'uppercase' }}>
                  {viewMode === 'ADMIN' ? 'ALL CELLS INTERACTIVE (BORDERLESS)' : 'MAIN DINING FLOOR'}
                </span>
              </div>
            </div>
          </div>
        </section>

      </div>

      {/* 3. Ticket Details Animated Pop-up Modal with Blurred Backdrop & Back Button */}
      {selectedBooking && (
        <div className="modal-overlay-bg" onClick={() => setSelectedBooking(null)}>
          <div className="modal-content-card" onClick={(e) => e.stopPropagation()} style={{ width: '420px' }}>
            {/* Header with Back Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <button
                onClick={() => setSelectedBooking(null)}
                className="btn-ghost"
                style={{ padding: '4px 8px', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <ArrowLeft size={14} /> Back to Waitlist
              </button>

              <span style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--brand-red)' }}>
                TICKET #{selectedBooking.id.substring(0, 6)}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '2px' }}>GUEST NAME</label>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, textTransform: 'uppercase', color: '#000000' }}>{selectedBooking.name}</h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', backgroundColor: 'var(--off-white)', padding: '12px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '2px' }}>RESERVATION TIME</label>
                  <p style={{ fontSize: '0.88rem', fontWeight: 850, color: '#000000' }}>
                    {new Date(selectedBooking.reservation_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '2px' }}>QUEUED GUESTS (ORDER POP)</label>
                  <p style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--brand-red)' }}>
                    {selectedBooking.party_size} GUESTS
                  </p>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '4px' }}>CONTACT PHONE</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <p style={{ fontSize: '0.88rem', fontWeight: 700, color: '#111111' }}>{selectedBooking.phone_number}</p>
                  <button
                    onClick={() => copyPhoneNumber(selectedBooking.phone_number)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', color: copiedFeedback ? 'var(--status-confirmed-text)' : 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700 }}
                  >
                    {copiedFeedback ? <CheckCheck size={12} /> : <Copy size={12} />}
                    {copiedFeedback ? 'COPIED' : 'COPY'}
                  </button>
                </div>
              </div>

              {selectedBooking.special_requests && (
                <div style={{ borderLeft: '3px solid #000000', padding: '10px 12px', backgroundColor: 'var(--light-grey)', borderRadius: '4px' }}>
                  <label style={{ display: 'block', fontSize: '0.62rem', color: 'var(--text-secondary)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>SPECIAL NOTES</label>
                  <p style={{ fontSize: '0.82rem', fontStyle: 'italic', color: '#111111', lineHeight: '1.4' }}>
                    "{selectedBooking.special_requests}"
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                {selectedBooking.party_size > 0 && (
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', backgroundColor: 'var(--brand-red-light)', padding: '8px 12px', borderRadius: '4px', fontWeight: 700 }}>
                    💡 <strong>Seating Instruction:</strong> Drag this customer ticket card from the left sidebar directly onto any table in the floor map to seat them.
                  </div>
                )}
                
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button
                    onClick={() => handleCancel(selectedBooking.id)}
                    className="btn-outline-red"
                    style={{ padding: '8px 14px' }}
                  >
                    <X size={14} /> Cancel Booking
                  </button>
                  <button
                    onClick={() => setSelectedBooking(null)}
                    className="btn-solid-black"
                    style={{ padding: '8px 14px' }}
                  >
                    Close Ticket
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Walk-In Reservation Modal */}
      {showWalkInModal && (
        <div className="modal-overlay-bg">
          <div className="modal-content-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 900, textTransform: 'uppercase', color: '#000000', letterSpacing: '0.5px' }}>NEW WALK-IN BOOKING</h3>
              <button 
                onClick={() => setShowWalkInModal(false)}
                style={{ backgroundColor: 'transparent', border: 'none', color: '#000000', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddWalkIn} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: '#000000', marginBottom: '4px' }}>GUEST NAME</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. JANE SMITH"
                  value={walkInName}
                  onChange={(e) => setWalkInName(e.target.value)}
                  className="search-input-field"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: '#000000', marginBottom: '4px' }}>CONTACT PHONE</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +41 79 342 11 00"
                  value={walkInPhone}
                  onChange={(e) => setWalkInPhone(e.target.value)}
                  className="search-input-field"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: '#000000', marginBottom: '4px' }}>PARTY SIZE (ORDER POP)</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={walkInGuests}
                    onChange={(e) => setWalkInGuests(parseInt(e.target.value) || 1)}
                    className="search-input-field"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: '#000000', marginBottom: '4px' }}>ASSIGN TABLE (OPTIONAL)</label>
                  <select
                    value={walkInTable}
                    onChange={(e) => setWalkInTable(e.target.value)}
                    className="search-input-field"
                  >
                    <option value="">No Table (Add to Waitlist)</option>
                    {tables.filter(t => t.current_capacity > 0).map(t => (
                      <option key={t.id} value={t.id}>{t.name} (Avail: {t.current_capacity} Pax)</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: '#000000', marginBottom: '4px' }}>SPECIAL NOTES</label>
                <textarea
                  placeholder="Allergies, highchairs, special occasions..."
                  value={walkInNotes}
                  onChange={(e) => setWalkInNotes(e.target.value)}
                  rows={2}
                  className="search-input-field"
                  style={{ resize: 'none', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowWalkInModal(false)}
                  className="btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-solid-black"
                >
                  Create Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Receptionist Table Action Modal */}
      {activeTableModal && (
        <div className="modal-overlay-bg" onClick={() => setActiveTableModal(null)}>
          <div className="modal-content-card" onClick={(e) => e.stopPropagation()} style={{ width: '360px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 900, textTransform: 'uppercase' }}>
                TABLE {activeTableModal.name} DETAILS
              </h3>
              <button onClick={() => setActiveTableModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.75rem', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>GRID CELL COORDINATE:</span>
                <strong>[Row {activeTableModal.row + 1}, Col {activeTableModal.col + 1}]</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>MAX CAPACITY:</span>
                <strong>{activeTableModal.capacity} PAX</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>AVAILABLE SEATS (TABLE POP):</span>
                <strong style={{ color: activeTableModal.current_capacity === 0 ? 'var(--brand-red)' : '#000000' }}>
                  {activeTableModal.current_capacity} SEATS
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>CURRENTLY SEATED:</span>
                <strong>{activeTableModal.seated_count} GUESTS</strong>
              </div>

              {activeTableModal.seated_parties && activeTableModal.seated_parties.length > 0 && (
                <div style={{ marginTop: '8px', padding: '10px', backgroundColor: 'var(--off-white)', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                  <label style={{ display: 'block', fontSize: '0.62rem', fontWeight: 800, color: 'var(--brand-red)', marginBottom: '4px' }}>SEATED PARTIES:</label>
                  {activeTableModal.seated_parties.map((p, idx) => (
                    <div key={idx} style={{ fontSize: '0.7rem', display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                      <span>{p.name}</span>
                      <strong>{p.seated_guests} PAX</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activeTableModal.seated_count > 0 && (
                <button
                  onClick={() => handleVacateTable(activeTableModal.id)}
                  className="btn-solid-black"
                  style={{ justifyContent: 'center' }}
                >
                  <RefreshCw size={14} /> Vacate & Reset Table ({activeTableModal.capacity} PAX)
                </button>
              )}

              <button
                onClick={() => setActiveTableModal(null)}
                className="btn-ghost"
                style={{ justifyContent: 'center' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Admin Edit Table Modal */}
      {showEditTableModal && (
        <div className="modal-overlay-bg" onClick={() => setShowEditTableModal(null)}>
          <div className="modal-content-card" onClick={(e) => e.stopPropagation()} style={{ width: '360px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--brand-red)' }}>
                EDIT TABLE {showEditTableModal.name}
              </h3>
              <button onClick={() => setShowEditTableModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEditedTable} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, marginBottom: '4px' }}>TABLE NAME</label>
                <input
                  type="text"
                  required
                  value={editTableName}
                  onChange={(e) => setEditTableName(e.target.value)}
                  className="search-input-field"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, marginBottom: '4px' }}>TABLE CAPACITY (PAX)</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  required
                  value={editTableCapacity}
                  onChange={(e) => setEditTableCapacity(parseInt(e.target.value) || 1)}
                  className="search-input-field"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, marginBottom: '4px' }}>GRID ROW (1 - {gridRows})</label>
                  <select
                    value={editTableRow}
                    onChange={(e) => setEditTableRow(parseInt(e.target.value))}
                    className="search-input-field"
                  >
                    {Array.from({ length: gridRows }).map((_, rIdx) => (
                      <option key={rIdx} value={rIdx}>Row {rIdx + 1}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, marginBottom: '4px' }}>GRID COL (1 - {gridCols})</label>
                  <select
                    value={editTableCol}
                    onChange={(e) => setEditTableCol(parseInt(e.target.value))}
                    className="search-input-field"
                  >
                    {Array.from({ length: gridCols }).map((_, cIdx) => (
                      <option key={cIdx} value={cIdx}>Col {cIdx + 1}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, marginBottom: '4px' }}>SHAPE</label>
                <select
                  value={editTableShape}
                  onChange={(e) => setEditTableShape(e.target.value as any)}
                  className="search-input-field"
                >
                  <option value="RECTANGLE">RECTANGLE</option>
                  <option value="CIRCLE">CIRCLE</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'space-between' }}>
                <button
                  type="button"
                  onClick={() => handleDeleteTable(showEditTableModal.id)}
                  className="btn-outline-red"
                  style={{ padding: '6px 12px', fontSize: '0.68rem' }}
                >
                  <Trash2 size={12} /> Delete Table
                </button>
                
                <button type="submit" className="btn-solid-black">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Admin Custom Table Creation Modal */}
      {showCustomTableModal && (
        <div className="modal-overlay-bg" onClick={() => setShowCustomTableModal(false)}>
          <div className="modal-content-card" onClick={(e) => e.stopPropagation()} style={{ width: '360px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--brand-red)' }}>
                CREATE CUSTOM TABLE
              </h3>
              <button onClick={() => setShowCustomTableModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateCustomTable} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, marginBottom: '4px' }}>TABLE CAPACITY (PAX)</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  required
                  value={customTableCapacity}
                  onChange={(e) => setCustomTableCapacity(parseInt(e.target.value) || 1)}
                  className="search-input-field"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, marginBottom: '4px' }}>SHAPE</label>
                <select
                  value={customTableShape}
                  onChange={(e) => setCustomTableShape(e.target.value as any)}
                  className="search-input-field"
                >
                  <option value="RECTANGLE">RECTANGLE</option>
                  <option value="CIRCLE">CIRCLE</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowCustomTableModal(false)} className="btn-ghost">
                  Cancel
                </button>
                <button type="submit" className="btn-solid-black">
                  Add to Floor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
