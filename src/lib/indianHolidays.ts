export type IndianHolidayType = 'national' | 'gazetted' | 'festival';

export interface IndianHoliday {
  date: string; // YYYY-MM-DD
  name: string;
  type: IndianHolidayType;
  note: string;
}

interface HolidayTemplate {
  mmdd: string;
  name: string;
  type: IndianHolidayType;
  note: string;
}

// Fixed-date National & Gazetted Holidays observed across India every year
const FIXED_ANNUAL_HOLIDAYS: HolidayTemplate[] = [
  {
    mmdd: '01-01',
    name: "New Year's Day",
    type: 'festival',
    note: 'Start of the Gregorian calendar year.',
  },
  {
    mmdd: '01-26',
    name: 'Republic Day',
    type: 'national',
    note: 'National Holiday · Honors the Constitution of India coming into effect in 1950.',
  },
  {
    mmdd: '05-01',
    name: 'May Day / Maharashtra & Gujarat Day',
    type: 'gazetted',
    note: 'International Workers’ Day and Statehood Day.',
  },
  {
    mmdd: '08-15',
    name: 'Independence Day',
    type: 'national',
    note: 'National Holiday · Commemorates India’s independence in 1947.',
  },
  {
    mmdd: '10-02',
    name: 'Gandhi Jayanti',
    type: 'national',
    note: 'National Holiday · Birth anniversary of Mahatma Gandhi.',
  },
  {
    mmdd: '12-25',
    name: 'Christmas Day',
    type: 'gazetted',
    note: 'Gazetted Public Holiday · Christmas celebrations across India.',
  },
];

// Movable lunar, solar & Hijri Indian Public / Gazetted / Major Festival Holidays (2025–2028)
const MOVABLE_HOLIDAYS_BY_YEAR: Record<number, HolidayTemplate[]> = {
  2025: [
    { mmdd: '01-14', name: 'Makar Sankranti / Pongal', type: 'festival', note: 'Harvest festival celebrated across India.' },
    { mmdd: '02-26', name: 'Maha Shivaratri', type: 'gazetted', note: 'Sacred festival dedicated to Lord Shiva.' },
    { mmdd: '03-14', name: 'Holi', type: 'gazetted', note: 'Festival of colors welcoming spring.' },
    { mmdd: '03-30', name: 'Ugadi / Gudi Padwa', type: 'festival', note: 'Lunar New Year in Karnataka, Andhra, Telangana & Maharashtra.' },
    { mmdd: '03-31', name: 'Eid-ul-Fitr (Ramzan Eid)', type: 'gazetted', note: 'Gazetted Holiday · Marks the end of Ramadan.' },
    { mmdd: '04-06', name: 'Ram Navami', type: 'gazetted', note: 'Celebrates the birth of Lord Rama.' },
    { mmdd: '04-10', name: 'Mahavir Jayanti', type: 'gazetted', note: 'Birth anniversary of Lord Mahavira.' },
    { mmdd: '04-18', name: 'Good Friday', type: 'gazetted', note: 'Christian observance of the crucifixion of Jesus Christ.' },
    { mmdd: '05-12', name: 'Buddha Purnima', type: 'gazetted', note: 'Celebrates the birth and enlightenment of Gautama Buddha.' },
    { mmdd: '06-07', name: 'Eid-ul-Adha (Bakrid)', type: 'gazetted', note: 'Gazetted Holiday · Festival of sacrifice.' },
    { mmdd: '07-06', name: 'Muharram', type: 'gazetted', note: 'Islamic New Year observance.' },
    { mmdd: '08-09', name: 'Raksha Bandhan', type: 'festival', note: 'Celebration of the bond between siblings.' },
    { mmdd: '08-16', name: 'Janmashtami', type: 'gazetted', note: 'Celebrates the birth of Lord Krishna.' },
    { mmdd: '08-27', name: 'Ganesh Chaturthi', type: 'festival', note: 'Celebrates the arrival of Lord Ganesha.' },
    { mmdd: '09-05', name: 'Milad-un-Nabi & Onam', type: 'gazetted', note: 'Prophet Mohammad’s Birthday & Thiruvonam harvest festival.' },
    { mmdd: '10-02', name: 'Dussehra (Vijayadashami)', type: 'gazetted', note: 'Celebrates the triumph of good over evil.' },
    { mmdd: '10-20', name: 'Diwali (Deepavali)', type: 'gazetted', note: 'Gazetted Holiday · Festival of lights.' },
    { mmdd: '11-05', name: 'Guru Nanak Jayanti', type: 'gazetted', note: 'Birth anniversary of Guru Nanak Dev Ji.' },
  ],
  2026: [
    { mmdd: '01-14', name: 'Makar Sankranti / Pongal', type: 'festival', note: 'Harvest festival celebrated across India.' },
    { mmdd: '02-15', name: 'Maha Shivaratri', type: 'gazetted', note: 'Sacred festival dedicated to Lord Shiva.' },
    { mmdd: '03-04', name: 'Holi', type: 'gazetted', note: 'Gazetted Holiday · Festival of colors welcoming spring.' },
    { mmdd: '03-19', name: 'Ugadi / Gudi Padwa', type: 'festival', note: 'Lunar New Year in Deccan & Maharashtra.' },
    { mmdd: '03-21', name: 'Eid-ul-Fitr (Ramzan Eid)', type: 'gazetted', note: 'Gazetted Holiday · Marks the end of Ramadan (subject to moon sighting).' },
    { mmdd: '03-26', name: 'Ram Navami', type: 'gazetted', note: 'Gazetted Holiday · Birth anniversary of Lord Rama.' },
    { mmdd: '03-31', name: 'Mahavir Jayanti', type: 'gazetted', note: 'Gazetted Holiday · Birth anniversary of Lord Mahavira.' },
    { mmdd: '04-03', name: 'Good Friday', type: 'gazetted', note: 'Gazetted Holiday · Christian observance preceding Easter.' },
    { mmdd: '05-01', name: 'Buddha Purnima', type: 'gazetted', note: 'Gazetted Holiday · Birth anniversary of Gautama Buddha.' },
    { mmdd: '05-27', name: 'Eid-ul-Zuha (Bakrid)', type: 'gazetted', note: 'Gazetted Holiday · Festival of sacrifice (subject to moon sighting).' },
    { mmdd: '06-26', name: 'Muharram', type: 'gazetted', note: 'Gazetted Holiday · Islamic New Year observance.' },
    { mmdd: '08-26', name: 'Milad-un-Nabi (Id-e-Milad)', type: 'gazetted', note: 'Gazetted Holiday · Prophet Mohammad’s Birthday.' },
    { mmdd: '08-26', name: 'Onam (Thiruvonam)', type: 'festival', note: 'Kerala’s annual harvest & cultural festival.' },
    { mmdd: '08-28', name: 'Raksha Bandhan', type: 'festival', note: 'Celebration of the bond between siblings.' },
    { mmdd: '09-04', name: 'Janmashtami', type: 'gazetted', note: 'Gazetted Holiday · Celebrates the birth of Lord Krishna.' },
    { mmdd: '09-14', name: 'Ganesh Chaturthi', type: 'festival', note: 'Celebrates the birth of Lord Ganesha.' },
    { mmdd: '10-20', name: 'Dussehra (Vijayadashami)', type: 'gazetted', note: 'Gazetted Holiday · Celebrates the victory of righteousness.' },
    { mmdd: '11-08', name: 'Diwali (Deepavali)', type: 'gazetted', note: 'Gazetted Holiday · Festival of lights across India.' },
    { mmdd: '11-24', name: 'Guru Nanak Jayanti', type: 'gazetted', note: 'Gazetted Holiday · Birth anniversary of Guru Nanak Dev Ji.' },
  ],
  2027: [
    { mmdd: '01-15', name: 'Makar Sankranti / Pongal', type: 'festival', note: 'Harvest festival celebrated across India.' },
    { mmdd: '03-06', name: 'Maha Shivaratri', type: 'gazetted', note: 'Sacred festival dedicated to Lord Shiva.' },
    { mmdd: '03-10', name: 'Eid-ul-Fitr (Ramzan Eid)', type: 'gazetted', note: 'Gazetted Holiday · Marks the end of Ramadan (subject to moon sighting).' },
    { mmdd: '03-23', name: 'Holi', type: 'gazetted', note: 'Gazetted Holiday · Festival of colors welcoming spring.' },
    { mmdd: '03-26', name: 'Good Friday', type: 'gazetted', note: 'Gazetted Holiday · Christian observance preceding Easter.' },
    { mmdd: '04-07', name: 'Ugadi / Gudi Padwa', type: 'festival', note: 'Lunar New Year in Karnataka, Andhra, Telangana & Maharashtra.' },
    { mmdd: '04-15', name: 'Ram Navami', type: 'gazetted', note: 'Gazetted Holiday · Birth anniversary of Lord Rama.' },
    { mmdd: '04-19', name: 'Mahavir Jayanti', type: 'gazetted', note: 'Gazetted Holiday · Birth anniversary of Lord Mahavira.' },
    { mmdd: '05-17', name: 'Eid-ul-Zuha (Bakrid)', type: 'gazetted', note: 'Gazetted Holiday · Festival of sacrifice.' },
    { mmdd: '05-20', name: 'Buddha Purnima', type: 'gazetted', note: 'Gazetted Holiday · Birth anniversary of Gautama Buddha.' },
    { mmdd: '06-16', name: 'Muharram', type: 'gazetted', note: 'Gazetted Holiday · Islamic New Year observance.' },
    { mmdd: '08-15', name: 'Milad-un-Nabi (Id-e-Milad)', type: 'gazetted', note: 'Gazetted Holiday · Prophet Mohammad’s Birthday.' },
    { mmdd: '08-17', name: 'Raksha Bandhan', type: 'festival', note: 'Celebration of the bond between siblings.' },
    { mmdd: '08-25', name: 'Janmashtami', type: 'gazetted', note: 'Gazetted Holiday · Celebrates the birth of Lord Krishna.' },
    { mmdd: '09-04', name: 'Ganesh Chaturthi', type: 'festival', note: 'Celebrates the birth of Lord Ganesha.' },
    { mmdd: '09-12', name: 'Onam (Thiruvonam)', type: 'festival', note: 'Kerala’s annual harvest & cultural festival.' },
    { mmdd: '10-09', name: 'Dussehra (Vijayadashami)', type: 'gazetted', note: 'Gazetted Holiday · Celebrates the victory of righteousness.' },
    { mmdd: '10-29', name: 'Diwali (Deepavali)', type: 'gazetted', note: 'Gazetted Holiday · Festival of lights across India.' },
    { mmdd: '11-14', name: 'Guru Nanak Jayanti', type: 'gazetted', note: 'Gazetted Holiday · Birth anniversary of Guru Nanak Dev Ji.' },
  ],
  2028: [
    { mmdd: '01-15', name: 'Makar Sankranti / Pongal', type: 'festival', note: 'Harvest festival celebrated across India.' },
    { mmdd: '02-23', name: 'Maha Shivaratri', type: 'gazetted', note: 'Sacred festival dedicated to Lord Shiva.' },
    { mmdd: '02-27', name: 'Eid-ul-Fitr (Ramzan Eid)', type: 'gazetted', note: 'Gazetted Holiday · Marks the end of Ramadan (subject to moon sighting).' },
    { mmdd: '03-11', name: 'Holi', type: 'gazetted', note: 'Gazetted Holiday · Festival of colors welcoming spring.' },
    { mmdd: '03-27', name: 'Ugadi / Gudi Padwa', type: 'festival', note: 'Lunar New Year in Deccan & Maharashtra.' },
    { mmdd: '04-03', name: 'Ram Navami', type: 'gazetted', note: 'Gazetted Holiday · Birth anniversary of Lord Rama.' },
    { mmdd: '04-14', name: 'Good Friday', type: 'gazetted', note: 'Gazetted Holiday · Christian observance preceding Easter.' },
    { mmdd: '08-05', name: 'Raksha Bandhan', type: 'festival', note: 'Celebration of the bond between siblings.' },
    { mmdd: '08-23', name: 'Ganesh Chaturthi', type: 'festival', note: 'Celebrates the birth of Lord Ganesha.' },
    { mmdd: '09-01', name: 'Onam (Thiruvonam)', type: 'festival', note: 'Kerala’s annual harvest & cultural festival.' },
    { mmdd: '09-27', name: 'Dussehra (Vijayadashami)', type: 'gazetted', note: 'Gazetted Holiday · Celebrates the victory of righteousness.' },
    { mmdd: '10-17', name: 'Diwali (Deepavali)', type: 'gazetted', note: 'Gazetted Holiday · Festival of lights across India.' },
  ],
};

const yearCache = new Map<number, IndianHoliday[]>();

export function getIndianHolidaysForYear(year: number): IndianHoliday[] {
  const cached = yearCache.get(year);
  if (cached) return cached;

  const list: IndianHoliday[] = [];
  for (const h of FIXED_ANNUAL_HOLIDAYS) {
    list.push({
      date: `${year}-${h.mmdd}`,
      name: h.name,
      type: h.type,
      note: h.note,
    });
  }
  const movable = MOVABLE_HOLIDAYS_BY_YEAR[year] || [];
  for (const h of movable) {
    list.push({
      date: `${year}-${h.mmdd}`,
      name: h.name,
      type: h.type,
      note: h.note,
    });
  }

  list.sort((a, b) => a.date.localeCompare(b.date));
  yearCache.set(year, list);
  return list;
}

export function getIndianHolidaysForDate(dateStr: string): IndianHoliday[] {
  const year = Number(dateStr.slice(0, 4));
  if (Number.isNaN(year) || year < 1900) return [];
  return getIndianHolidaysForYear(year).filter((h) => h.date === dateStr);
}

export function getUpcomingIndianHolidays(fromDateStr: string, limit = 4): IndianHoliday[] {
  const year = Number(fromDateStr.slice(0, 4)) || new Date().getFullYear();
  const pool = [
    ...getIndianHolidaysForYear(year),
    ...getIndianHolidaysForYear(year + 1),
  ];
  return pool.filter((h) => h.date >= fromDateStr).slice(0, limit);
}

export function formatHolidayTypeLabel(type: IndianHolidayType): string {
  if (type === 'national') return 'National Public Holiday (India)';
  if (type === 'gazetted') return 'Gazetted Public Holiday (India)';
  return 'Indian Cultural Festival';
}
