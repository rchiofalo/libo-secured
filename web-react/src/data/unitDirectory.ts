// Marine Corps Unit Directory Reference Data
// Common units with addresses for letterhead and correspondence

export interface UnitInfo {
  name: string;
  fullName: string;
  parentCommand?: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  region?: string;
}

export interface UnitCategory {
  name: string;
  units: UnitInfo[];
}

export const UNIT_CATEGORIES: UnitCategory[] = [
  {
    name: 'Headquarters Marine Corps',
    units: [
      {
        name: 'HQMC',
        fullName: 'HEADQUARTERS MARINE CORPS',
        address: '3000 MARINE CORPS PENTAGON',
        city: 'WASHINGTON',
        state: 'DC',
        zip: '20350-3000',
        region: 'National Capital Region',
      },
      {
        name: 'HQMC M&RA',
        fullName: 'HEADQUARTERS MARINE CORPS, MANPOWER AND RESERVE AFFAIRS',
        address: '3280 RUSSELL ROAD',
        city: 'QUANTICO',
        state: 'VA',
        zip: '22134-5103',
        region: 'National Capital Region',
      },
      {
        name: 'HQMC I&L',
        fullName: 'HEADQUARTERS MARINE CORPS, INSTALLATIONS AND LOGISTICS',
        address: '3000 MARINE CORPS PENTAGON',
        city: 'WASHINGTON',
        state: 'DC',
        zip: '20350-3000',
        region: 'National Capital Region',
      },
      {
        name: 'HQMC PP&O',
        fullName: 'HEADQUARTERS MARINE CORPS, PLANS POLICIES AND OPERATIONS',
        address: '3000 MARINE CORPS PENTAGON',
        city: 'WASHINGTON',
        state: 'DC',
        zip: '20350-3000',
        region: 'National Capital Region',
      },
    ],
  },
  {
    name: 'Marine Corps Forces',
    units: [
      {
        name: 'MARFORCOM',
        fullName: 'MARINE FORCES COMMAND',
        address: '1775 NORMAN AVENUE',
        city: 'NORFOLK',
        state: 'VA',
        zip: '23511-2388',
        region: 'East Coast',
      },
      {
        name: 'MARFORPAC',
        fullName: 'MARINE FORCES PACIFIC',
        address: 'BOX 64108',
        city: 'CAMP H.M. SMITH',
        state: 'HI',
        zip: '96861-4108',
        region: 'Pacific',
      },
      {
        name: 'MARFORRES',
        fullName: 'MARINE FORCES RESERVE',
        address: '2000 OPELOUSAS AVENUE',
        city: 'NEW ORLEANS',
        state: 'LA',
        zip: '70114-0001',
        region: 'Reserve',
      },
    ],
  },
  {
    name: 'Marine Expeditionary Forces',
    units: [
      {
        name: 'I MEF',
        fullName: 'I MARINE EXPEDITIONARY FORCE',
        address: 'BOX 555300',
        city: 'CAMP PENDLETON',
        state: 'CA',
        zip: '92055-5300',
        region: 'West Coast',
      },
      {
        name: 'II MEF',
        fullName: 'II MARINE EXPEDITIONARY FORCE',
        address: 'PSC BOX 20080',
        city: 'CAMP LEJEUNE',
        state: 'NC',
        zip: '28542-0080',
        region: 'East Coast',
      },
      {
        name: 'III MEF',
        fullName: 'III MARINE EXPEDITIONARY FORCE',
        address: 'UNIT 35001',
        city: 'FPO',
        state: 'AP',
        zip: '96373-5001',
        region: 'Pacific',
      },
    ],
  },
  {
    name: 'Marine Divisions',
    units: [
      {
        name: '1st MarDiv',
        fullName: '1ST MARINE DIVISION',
        address: 'BOX 555520',
        city: 'CAMP PENDLETON',
        state: 'CA',
        zip: '92055-5520',
        region: 'West Coast',
      },
      {
        name: '2d MarDiv',
        fullName: '2D MARINE DIVISION',
        address: 'PSC BOX 20004',
        city: 'CAMP LEJEUNE',
        state: 'NC',
        zip: '28542-0004',
        region: 'East Coast',
      },
      {
        name: '3d MarDiv',
        fullName: '3D MARINE DIVISION',
        address: 'UNIT 35002',
        city: 'FPO',
        state: 'AP',
        zip: '96373-5002',
        region: 'Pacific',
      },
      {
        name: '4th MarDiv',
        fullName: '4TH MARINE DIVISION',
        address: '2000 OPELOUSAS AVENUE',
        city: 'NEW ORLEANS',
        state: 'LA',
        zip: '70114-0001',
        region: 'Reserve',
      },
    ],
  },
  {
    name: 'Marine Aircraft Wings',
    units: [
      {
        name: '1st MAW',
        fullName: '1ST MARINE AIRCRAFT WING',
        address: 'UNIT 35003',
        city: 'FPO',
        state: 'AP',
        zip: '96373-5003',
        region: 'Pacific',
      },
      {
        name: '2d MAW',
        fullName: '2D MARINE AIRCRAFT WING',
        address: 'PSC BOX 8050',
        city: 'CHERRY POINT',
        state: 'NC',
        zip: '28533-0050',
        region: 'East Coast',
      },
      {
        name: '3d MAW',
        fullName: '3D MARINE AIRCRAFT WING',
        address: 'BOX 452001',
        city: 'SAN DIEGO',
        state: 'CA',
        zip: '92145-2001',
        region: 'West Coast',
      },
      {
        name: '4th MAW',
        fullName: '4TH MARINE AIRCRAFT WING',
        address: '2000 OPELOUSAS AVENUE',
        city: 'NEW ORLEANS',
        state: 'LA',
        zip: '70114-0001',
        region: 'Reserve',
      },
    ],
  },
  {
    name: 'Marine Logistics Groups',
    units: [
      {
        name: '1st MLG',
        fullName: '1ST MARINE LOGISTICS GROUP',
        address: 'BOX 555600',
        city: 'CAMP PENDLETON',
        state: 'CA',
        zip: '92055-5600',
        region: 'West Coast',
      },
      {
        name: '2d MLG',
        fullName: '2D MARINE LOGISTICS GROUP',
        address: 'PSC BOX 20100',
        city: 'CAMP LEJEUNE',
        state: 'NC',
        zip: '28542-0100',
        region: 'East Coast',
      },
      {
        name: '3d MLG',
        fullName: '3D MARINE LOGISTICS GROUP',
        address: 'UNIT 35004',
        city: 'FPO',
        state: 'AP',
        zip: '96373-5004',
        region: 'Pacific',
      },
      {
        name: '4th MLG',
        fullName: '4TH MARINE LOGISTICS GROUP',
        address: '2000 OPELOUSAS AVENUE',
        city: 'NEW ORLEANS',
        state: 'LA',
        zip: '70114-0001',
        region: 'Reserve',
      },
    ],
  },
  {
    name: 'Training Commands',
    units: [
      {
        name: 'TECOM',
        fullName: 'TRAINING AND EDUCATION COMMAND',
        address: '1019 ELLIOT ROAD',
        city: 'QUANTICO',
        state: 'VA',
        zip: '22134-5001',
        region: 'National Capital Region',
      },
      {
        name: 'MCU',
        fullName: 'MARINE CORPS UNIVERSITY',
        address: '2076 SOUTH STREET',
        city: 'QUANTICO',
        state: 'VA',
        zip: '22134',
        region: 'National Capital Region',
      },
      {
        name: 'TBS',
        fullName: 'THE BASIC SCHOOL',
        address: '24191 GILBERT ROAD',
        city: 'QUANTICO',
        state: 'VA',
        zip: '22134-5019',
        region: 'National Capital Region',
      },
      {
        name: 'OCS',
        fullName: 'OFFICER CANDIDATES SCHOOL',
        address: '2189 ELROD AVENUE',
        city: 'QUANTICO',
        state: 'VA',
        zip: '22134-5003',
        region: 'National Capital Region',
      },
      {
        name: 'MCRD San Diego',
        fullName: 'MARINE CORPS RECRUIT DEPOT SAN DIEGO',
        address: '1600 HENDERSON AVENUE',
        city: 'SAN DIEGO',
        state: 'CA',
        zip: '92140',
        region: 'West Coast',
      },
      {
        name: 'MCRD Parris Island',
        fullName: 'MARINE CORPS RECRUIT DEPOT PARRIS ISLAND',
        address: 'BOX 5100',
        city: 'PARRIS ISLAND',
        state: 'SC',
        zip: '29905-5100',
        region: 'East Coast',
      },
    ],
  },
  {
    name: 'Marine Corps Installations',
    units: [
      {
        name: 'MCB Camp Pendleton',
        fullName: 'MARINE CORPS BASE CAMP PENDLETON',
        address: 'BOX 555010',
        city: 'CAMP PENDLETON',
        state: 'CA',
        zip: '92055-5010',
        region: 'West Coast',
      },
      {
        name: 'MCB Camp Lejeune',
        fullName: 'MARINE CORPS BASE CAMP LEJEUNE',
        address: 'PSC BOX 20004',
        city: 'CAMP LEJEUNE',
        state: 'NC',
        zip: '28542-0004',
        region: 'East Coast',
      },
      {
        name: 'MCB Quantico',
        fullName: 'MARINE CORPS BASE QUANTICO',
        address: '3250 CATLIN AVENUE',
        city: 'QUANTICO',
        state: 'VA',
        zip: '22134-5001',
        region: 'National Capital Region',
      },
      {
        name: 'MCAS Miramar',
        fullName: 'MARINE CORPS AIR STATION MIRAMAR',
        address: 'BOX 452001',
        city: 'SAN DIEGO',
        state: 'CA',
        zip: '92145-2001',
        region: 'West Coast',
      },
      {
        name: 'MCAS Cherry Point',
        fullName: 'MARINE CORPS AIR STATION CHERRY POINT',
        address: 'PSC BOX 8001',
        city: 'CHERRY POINT',
        state: 'NC',
        zip: '28533-0001',
        region: 'East Coast',
      },
      {
        name: 'MCAS Yuma',
        fullName: 'MARINE CORPS AIR STATION YUMA',
        address: 'BOX 99100',
        city: 'YUMA',
        state: 'AZ',
        zip: '85369-9100',
        region: 'West Coast',
      },
      {
        name: 'MCAGCC Twentynine Palms',
        fullName: 'MARINE CORPS AIR GROUND COMBAT CENTER',
        address: 'BOX 788100',
        city: 'TWENTYNINE PALMS',
        state: 'CA',
        zip: '92278-8100',
        region: 'West Coast',
      },
      {
        name: 'MCB Hawaii',
        fullName: 'MARINE CORPS BASE HAWAII',
        address: 'BOX 63002',
        city: 'KANEOHE BAY',
        state: 'HI',
        zip: '96863-3002',
        region: 'Pacific',
      },
    ],
  },
  {
    name: 'Infantry Regiments (Sample)',
    units: [
      {
        name: '1st Marines',
        fullName: '1ST MARINE REGIMENT',
        parentCommand: '1ST MARINE DIVISION',
        address: 'BOX 555521',
        city: 'CAMP PENDLETON',
        state: 'CA',
        zip: '92055-5521',
        region: 'West Coast',
      },
      {
        name: '5th Marines',
        fullName: '5TH MARINE REGIMENT',
        parentCommand: '1ST MARINE DIVISION',
        address: 'BOX 555525',
        city: 'CAMP PENDLETON',
        state: 'CA',
        zip: '92055-5525',
        region: 'West Coast',
      },
      {
        name: '6th Marines',
        fullName: '6TH MARINE REGIMENT',
        parentCommand: '2D MARINE DIVISION',
        address: 'PSC BOX 20006',
        city: 'CAMP LEJEUNE',
        state: 'NC',
        zip: '28542-0006',
        region: 'East Coast',
      },
      {
        name: '8th Marines',
        fullName: '8TH MARINE REGIMENT',
        parentCommand: '2D MARINE DIVISION',
        address: 'PSC BOX 20008',
        city: 'CAMP LEJEUNE',
        state: 'NC',
        zip: '28542-0008',
        region: 'East Coast',
      },
    ],
  },
];

// Flatten all units for easy searching
export const ALL_UNITS: UnitInfo[] = UNIT_CATEGORIES.flatMap((cat) => cat.units);

// Format full address
export function formatUnitAddress(unit: UnitInfo): string {
  return `${unit.address}, ${unit.city}, ${unit.state} ${unit.zip}`;
}

// Format for letterhead
export function formatLetterhead(unit: UnitInfo): { line1: string; line2: string; address: string } {
  return {
    line1: unit.fullName,
    line2: unit.parentCommand || '',
    address: formatUnitAddress(unit),
  };
}
